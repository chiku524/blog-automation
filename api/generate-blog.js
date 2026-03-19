/**
 * Vercel serverless function – generates weekly blog posts.
 * Creates: one post per repo + one generic summary post.
 * Triggered by cron (Fridays) or manually with CRON_SECRET.
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getActivityForRepos, getWeeklyReportWindow } from "../lib/github.js";
import { generateBlogPost, generateRepoBlogPost } from "../lib/ai.js";
import { createNotionPage } from "../lib/notion.js";
import { getThemeForPost } from "../lib/themes.js";
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


function extractTitle(content, weekLabel) {
  const m = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
  return m ? m[1].trim() : `Weekly Dev Digest – ${weekLabel}`;
}

function repoFeedSlug(repo) {
  return `${repo.owner}/${repo.repo}`;
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

    const defaultTheme = config.defaultTheme ?? "default";
    const { since, weekLabel } = getWeeklyReportWindow();

    const activity = await getActivityForRepos(
      repos,
      getEnv("GITHUB_TOKEN"),
      since
    );

    const parentId = getEnv("NOTION_BLOG_PARENT_ID");
    const genericParentId = getEnvOptional("NOTION_GENERIC_BLOG_PARENT_ID") || parentId;
    const isDatabase = process.env.NOTION_PARENT_TYPE === "database";

    const repoPages = [];
    for (const repo of activity) {
      const content = await generateRepoBlogPost({
        repo,
        weekLabel,
        apiKey: getEnv("OPENAI_API_KEY"),
      });
      const title = extractTitle(content, weekLabel);
      const feedSlug = repoFeedSlug(repo);
      const repoParentId = isDatabase ? parentId : (repo.notion_parent_id || parentId);

      const theme = getThemeForPost({ repo, defaultTheme });
      const page = await createNotionPage({
        apiKey: getEnv("NOTION_API_KEY"),
        parentId: repoParentId,
        title,
        content,
        isDatabase,
        feed: isDatabase ? feedSlug : undefined,
        theme,
      });
      repoPages.push({ repo: feedSlug, title, notionUrl: page.url || page.id });
    }

    const genericContent = await generateBlogPost({
      activeRepos: activity,
      weekLabel,
      apiKey: getEnv("OPENAI_API_KEY"),
    });
    const genericTitle = extractTitle(genericContent, weekLabel);
    const genericPage = await createNotionPage({
      apiKey: getEnv("NOTION_API_KEY"),
      parentId: isDatabase ? parentId : genericParentId,
      title: genericTitle,
      content: genericContent,
      isDatabase,
      feed: isDatabase ? "generic" : undefined,
      theme: "weekly",
    });

    let devtoUrl = null;
    let mediumUrl = null;
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL || "";
    const canonicalUrl = baseUrl
      ? `${baseUrl}/post/${(genericPage.id || "").replace(/-/g, "")}`
      : undefined;

    const devtoKey = process.env.DEVTO_API_KEY;
    if (devtoKey) {
      try {
        const devto = await publishToDevto({
          apiKey: devtoKey,
          title: genericTitle,
          bodyMarkdown: genericContent,
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
          title: genericTitle,
          bodyMarkdown: genericContent,
          canonicalUrl,
        });
        mediumUrl = medium?.data?.url || medium?.url;
      } catch (err) {
        console.error("Medium publish error:", err);
      }
    }

    return res.status(200).json({
      ok: true,
      weekLabel,
      repoPages,
      genericPost: { title: genericTitle, notionUrl: genericPage.url || genericPage.id, devtoUrl, mediumUrl },
      activeRepos: activity.filter((r) => r.hasActivity).length,
    });
  } catch (err) {
    console.error("Blog generation error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Blog generation failed" });
  }
}
