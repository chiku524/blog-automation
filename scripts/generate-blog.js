#!/usr/bin/env node
/**
 * Generate weekly blog post from GitHub repo activity and publish to Notion.
 * Run manually: node scripts/generate-blog.js
 * Or via cron: see api/generate-blog.js (Vercel)
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getActivityForRepos } from "../lib/github.js";
import { generateBlogPost } from "../lib/ai.js";
import { createNotionPage } from "../lib/notion.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDryRun = process.argv.includes("--dry-run");

function getEnv(name) {
  const v = process.env[name];
  if (!v && !isDryRun) {
    throw new Error(`Missing env: ${name}`);
  }
  return v || "placeholder";
}

function getWeekLabel() {
  const now = new Date();
  const lastFriday = new Date(now);
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  lastFriday.setDate(now.getDate() - diff);
  const prevFriday = new Date(lastFriday);
  prevFriday.setDate(lastFriday.getDate() - 7);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(prevFriday)} – ${fmt(lastFriday)}`;
}

function extractTitle(content) {
  const firstH1 = content.match(/^#\s+(.+)$/m);
  if (firstH1) return firstH1[1].trim();
  const firstH2 = content.match(/^##\s+(.+)$/m);
  if (firstH2) return firstH2[1].trim();
  return `Weekly Dev Digest – ${getWeekLabel()}`;
}

async function main() {
  console.log("📝 Blog automation – generating weekly post...\n");

  const configPath = join(__dirname, "..", "config", "repos.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const repos = config.repositories;

  if (!repos?.length) {
    throw new Error("config/repos.json must have at least one repository");
  }

  const weekLabel = getWeekLabel();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  console.log(`Week: ${weekLabel}`);
  console.log(`Tracking ${repos.length} repos since ${since.toISOString().slice(0, 10)}\n`);

  const token = getEnv("GITHUB_TOKEN");
  const activity = await getActivityForRepos(repos, token, since);
  const activeCount = activity.filter((r) => r.hasActivity).length;

  console.log(`Repos with activity: ${activeCount}/${repos.length}`);

  const apiKey = getEnv("OPENAI_API_KEY");
  const content = await generateBlogPost({
    activeRepos: activity,
    weekLabel,
    apiKey,
  });

  const title = extractTitle(content);
  console.log(`Generated: "${title}"\n`);

  if (isDryRun) {
    console.log("--- DRY RUN: content preview ---");
    console.log(content.slice(0, 800) + "...\n");
    console.log("(Not publishing to Notion)");
    return;
  }

  const notionKey = getEnv("NOTION_API_KEY");
  const parentId = getEnv("NOTION_BLOG_PARENT_ID");
  const isDatabase = process.env.NOTION_PARENT_TYPE === "database";

  const page = await createNotionPage({
    apiKey: notionKey,
    parentId,
    title,
    content,
    isDatabase,
  });

  console.log(`✅ Published to Notion: ${page.url || page.id}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
