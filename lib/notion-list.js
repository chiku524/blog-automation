/**
 * List child pages (blog posts) from a Notion parent page or database.
 */

import { Client } from "@notionhq/client";

/**
 * Get all child pages of a Notion page (blog posts)
 * @param {string} apiKey - Notion integration secret
 * @param {string} parentId - Page ID or database ID
 * @param {object} [opts]
 * @param {string} [opts.parentType] - "page" or "database"
 * @param {string} [opts.feed] - Filter by Feed property (database only, e.g. "generic" or "owner/repo")
 * @returns {Promise<Array<{ id: string, title: string, url: string, created_time: string }>>}
 */
export async function listChildPages(apiKey, parentId, opts = {}) {
  const notion = new Client({ auth: apiKey });
  const { parentType = "page", feed } = opts;

  if (parentType === "database") {
    return listDatabasePages(notion, parentId, feed);
  }

  return listPageChildren(notion, parentId);
}

async function listDatabasePages(notion, databaseId, feedFilter) {
  const results = [];
  let cursor = undefined;

  const filter = feedFilter
    ? {
        property: "Feed",
        rich_text: { equals: feedFilter },
      }
    : undefined;

  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
      ...(filter && { filter: filter }),
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });

    for (const page of res.results || []) {
      const titleProp = page.properties?.title ?? page.properties?.Name;
      const title =
        titleProp?.title?.[0]?.plain_text ||
        titleProp?.rich_text?.[0]?.plain_text ||
        "Untitled";
      const feedProp = page.properties?.Feed;
      const feed =
        feedProp?.rich_text?.[0]?.plain_text ||
        feedProp?.select?.name ||
        null;
      results.push({
        id: page.id,
        title,
        url: page.url || (page.id ? `https://www.notion.so/${page.id.replace(/-/g, "")}` : null),
        created_time: page.created_time,
        feed: feed || undefined,
      });
    }

    cursor = res.next_cursor;
  } while (cursor);

  return results;
}

async function listPageChildren(notion, parentId) {
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
