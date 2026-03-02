/**
 * API: List available blog feeds (for feed selector).
 * GET /api/feeds – returns { feeds: ["generic", "owner/repo", ...] }
 */

import { readFileSync } from "fs";
import { join } from "path";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const configPath = join(process.cwd(), "config", "repos.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const repos = config.repositories || [];

    const feeds = [
      "generic",
      ...repos.map((r) => `${r.owner}/${r.repo}`),
    ];

    return res.status(200).json({ feeds });
  } catch (err) {
    console.error("Feeds error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch feeds" });
  }
}
