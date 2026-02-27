/**
 * Vercel serverless function – generates weekly blog post.
 * Triggered by cron (Fridays) or manually with CRON_SECRET.
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getActivityForRepos } from "../lib/github.js";
import { generateBlogPost } from "../lib/ai.js";
import { createNotionPage } from "../lib/notion.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getWeekLabel() {
  const now = new Date();
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  const lastFriday = new Date(now);
  lastFriday.setDate(now.getDate() - diff);
  const prevFriday = new Date(lastFriday);
  prevFriday.setDate(lastFriday.getDate() - 7);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(prevFriday)} – ${fmt(lastFriday)}`;
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
  return m ? m[1].trim() : `Weekly Dev Digest – ${getWeekLabel()}`;
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

    const weekLabel = getWeekLabel();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const activity = await getActivityForRepos(
      repos,
      getEnv("GITHUB_TOKEN"),
      since
    );

    const content = await generateBlogPost({
      activeRepos: activity,
      weekLabel,
      apiKey: getEnv("OPENAI_API_KEY"),
    });

    const title = extractTitle(content);
    const parentId = getEnv("NOTION_BLOG_PARENT_ID");
    const isDatabase = process.env.NOTION_PARENT_TYPE === "database";

    const page = await createNotionPage({
      apiKey: getEnv("NOTION_API_KEY"),
      parentId,
      title,
      content,
      isDatabase,
    });

    return res.status(200).json({
      ok: true,
      title,
      weekLabel,
      url: page.url || page.id,
      activeRepos: activity.filter((r) => r.hasActivity).length,
    });
  } catch (err) {
    console.error("Blog generation error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Blog generation failed" });
  }
}
