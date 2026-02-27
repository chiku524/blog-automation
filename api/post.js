/**
 * API: Get a single blog post's full content.
 * GET /api/post?id=xxx
 */

import "dotenv/config";
import { getPageContent } from "../lib/notion-content.js";

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query?.id;
  if (!id) {
    return res.status(400).json({ error: "Missing id parameter" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const post = await getPageContent(
      getEnv("NOTION_API_KEY"),
      id
    );
    return res.status(200).json(post);
  } catch (err) {
    console.error("Get post error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to fetch post" });
  }
}
