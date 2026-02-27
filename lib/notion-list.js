/**
 * List child pages (blog posts) from a Notion parent page.
 */

import { Client } from "@notionhq/client";

/**
 * Get all child pages of a Notion page (blog posts)
 * @param {string} apiKey - Notion integration secret
 * @param {string} parentId - Page ID (Dev Log)
 * @returns {Promise<Array<{ id: string, title: string, url: string, created_time: string }>>}
 */
export async function listChildPages(apiKey, parentId) {
  const notion = new Client({ auth: apiKey });
  const results = [];
  let cursor = undefined;

  do {
    const res = await notion.blocks.children.list({
      block_id: parentId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of res.results || []) {
      if (block.type === "child_page") {
        const cp = block.child_page || block.child_database || {};
        const title =
          (typeof cp.title === "string" && cp.title) ||
          cp.rich_text?.map((t) => t.plain_text).join("") ||
          "Untitled";
        results.push({
          id: block.id,
          title,
          url: block.id ? `https://www.notion.so/${block.id.replace(/-/g, "")}` : null,
          created_time: block.created_time,
        });
      }
    }

    cursor = res.next_cursor;
  } while (cursor);

  results.sort(
    (a, b) =>
      new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
  );
  return results;
}
