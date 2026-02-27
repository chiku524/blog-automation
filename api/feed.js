/**
 * API: RSS feed of blog posts.
 * GET /api/feed – returns application/rss+xml
 */

import "dotenv/config";
import { listChildPages } from "../lib/notion-list.js";
import { getPageContent } from "../lib/notion-content.js";

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).setHeader("Allow", "GET").end();
  }

  try {
    const apiKey = getEnv("NOTION_API_KEY");
    const parentId = getEnv("NOTION_BLOG_PARENT_ID");
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.SITE_URL || "https://blog-automation.vercel.app";

    const posts = await listChildPages(apiKey, parentId);
    const postIds = (posts || []).slice(0, 20).map((p) => p.id);

    const items = await Promise.all(
      postIds.map(async (id) => {
        const post = posts.find((p) => p.id === id);
        let html = "";
        let excerpt = post?.title || "";
        try {
          const content = await getPageContent(apiKey, id);
          html = content.html;
          excerpt = stripHtml(content.html) || post?.title || "";
        } catch {
          excerpt = post?.title || "Read more.";
        }
        const postUrl = `${baseUrl}/post/${id.replace(/-/g, "")}`;
        const pubDate = new Date(post?.created_time || 0).toUTCString();
        return {
          title: escapeXml(post?.title || "Untitled"),
          link: postUrl,
          description: escapeXml(excerpt),
          content: html,
          pubDate,
        };
      })
    );

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Dev Log</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Weekly dev digests from GitHub activity</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(baseUrl)}/api/feed" rel="self" type="application/rss+xml"/>
    ${items
      .map(
        (item) => `
    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <description>${item.description}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${item.link}</guid>
      <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/"><![CDATA[${(item.content || "").replace(/\]\]>/g, "]]]]><![CDATA[>")}]]></content:encoded>
    </item>`
      )
      .join("")}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return res.status(200).send(rss);
  } catch (err) {
    console.error("Feed error:", err);
    return res.status(500).send("Feed generation failed");
  }
}
