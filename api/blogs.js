/**
 * API: List all blog posts from Notion.
 * GET /api/blogs – returns JSON array of blog posts
 */

import { listChildPages } from "../lib/notion-list.js";

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const blogs = await listChildPages(
      getEnv("NOTION_API_KEY"),
      getEnv("NOTION_BLOG_PARENT_ID")
    );
    return res.status(200).json(blogs);
  } catch (err) {
    console.error("List blogs error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to fetch blogs" });
  }
}
