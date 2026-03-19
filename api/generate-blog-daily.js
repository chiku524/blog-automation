/**
 * Vercel serverless function – generates a daily generic blog post.
 * Uses activity from today (00:00 UTC) across all repos; creates one post (Feed=generic).
 * Triggered by cron every day at 23:59 UTC (11:59 PM) or manually with CRON_SECRET.
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getActivityForRepos } from "../lib/github.js";
import { generateDailyBlogPost } from "../lib/ai.js";
import { createNotionPage } from "../lib/notion.js";
import { publishToDevto } from "../lib/devto.js";
import { publishToMedium } from "../lib/medium.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getEnvOptional(name) {
  return process.env[name] || null;
}

/**
 * Get the UTC date we should report for the daily post.
 * If it's the first hour of the day in UTC (00:00–00:59), we report *yesterday*
 * so that a cron running at 00:01 UTC summarizes the previous day. Otherwise we report today.
 * This fixes the title being one day ahead and missing commits when cron runs after midnight UTC.
 */
function getReportDateUTC() {
  const now = new Date();
  const reportDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  if (now.getUTCHours() === 0) {
    reportDate.setUTCDate(reportDate.getUTCDate() - 1);
  }
  return reportDate;
}

function getDayLabel(reportDate) {
  return reportDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function extractTitle(content, dayLabel) {
  const m = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
  return m ? m[1].trim() : `Daily Dev Digest – ${dayLabel}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || req.query?.secret || "";
    const provided = auth.replace(/^Bearer\s+/i, "") || req.query?.secret;
    if (provided !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const configPath = join(process.cwd(), "config", "repos.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const repos = config.repositories;

    if (!repos?.length) {
      throw new Error("config/repos.json has no repositories");
    }

    const reportDate = getReportDateUTC();
    const dayLabel = getDayLabel(reportDate);
    const since = new Date(reportDate);
    since.setUTCHours(0, 0, 0, 0);
    const until = new Date(reportDate);
    until.setUTCDate(until.getUTCDate() + 1);
    until.setUTCHours(0, 0, 0, 0);

    const activity = await getActivityForRepos(
      repos,
      getEnv("GITHUB_TOKEN"),
      since,
      until
    );

    const content = await generateDailyBlogPost({
      activeRepos: activity,
      dayLabel,
      apiKey: getEnv("OPENAI_API_KEY"),
    });

    const title = extractTitle(content, dayLabel);
    const parentId = getEnv("NOTION_BLOG_PARENT_ID");
    const genericParentId = getEnvOptional("NOTION_GENERIC_BLOG_PARENT_ID") || parentId;
    const isDatabase = process.env.NOTION_PARENT_TYPE === "database";

    const page = await createNotionPage({
      apiKey: getEnv("NOTION_API_KEY"),
      parentId: isDatabase ? parentId : genericParentId,
      title,
      content,
      isDatabase,
      feed: isDatabase ? "generic" : undefined,
      theme: "daily",
    });

    let devtoUrl = null;
    let mediumUrl = null;
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL || "";
    const canonicalUrl = baseUrl
      ? `${baseUrl}/post/${(page.id || "").replace(/-/g, "")}`
      : undefined;

    const devtoKey = process.env.DEVTO_API_KEY;
    if (devtoKey) {
      try {
        const devto = await publishToDevto({
          apiKey: devtoKey,
          title,
          bodyMarkdown: content,
          canonicalUrl,
        });
        devtoUrl = devto.url;
      } catch (err) {
        console.error("Dev.to publish error:", err);
      }
    }

    const mediumToken = process.env.MEDIUM_API_KEY;
    if (mediumToken) {
      try {
        const medium = await publishToMedium({
          apiKey: mediumToken,
          userId: process.env.MEDIUM_USER_ID || undefined,
          title,
          bodyMarkdown: content,
          canonicalUrl,
        });
        mediumUrl = medium?.data?.url || medium?.url;
      } catch (err) {
        console.error("Medium publish error:", err);
      }
    }

    return res.status(200).json({
      ok: true,
      dayLabel,
      title,
      notionUrl: page.url || page.id,
      devtoUrl,
      mediumUrl,
      activeRepos: activity.filter((r) => r.hasActivity).length,
    });
  } catch (err) {
    console.error("Daily blog generation error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Daily blog generation failed" });
  }
}
