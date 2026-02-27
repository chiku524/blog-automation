/**
 * Fetch page content from Notion and convert blocks to HTML.
 */

import { Client } from "@notionhq/client";

function richTextToHtml(richText = []) {
  if (!Array.isArray(richText)) return "";
  return richText
    .map((t) => {
      let html = escapeHtml(t.plain_text || "");
      if (t.annotations?.bold) html = `<strong>${html}</strong>`;
      if (t.annotations?.italic) html = `<em>${html}</em>`;
      if (t.annotations?.code) html = `<code>${html}</code>`;
      if (t.annotations?.strikethrough) html = `<s>${html}</s>`;
      if (t.href) html = `<a href="${escapeHtml(t.href)}" rel="noopener noreferrer">${html}</a>`;
      return html;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blockToHtml(block) {
  const type = block.type;
  const data = block[type] || {};
  const plainText = (data.rich_text || []).map((t) => t.plain_text || "").join("");
  const content = richTextToHtml(data.rich_text);

  switch (type) {
    case "heading_1":
      return `<h1>${content}</h1>`;
    case "heading_2":
      return `<h2>${content}</h2>`;
    case "heading_3":
      return `<h3>${content}</h3>`;
    case "paragraph":
      return content ? `<p>${content}</p>` : "";
    case "bulleted_list_item":
      return `<li>${content || "&nbsp;"}</li>`;
    case "numbered_list_item":
      return `<li>${content || "&nbsp;"}</li>`;
    case "quote":
      return `<blockquote><p>${content || "&nbsp;"}</p></blockquote>`;
    case "code":
      const lang = data.language || "plain text";
      return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(plainText)}</code></pre>`;
    case "to_do":
      const checked = data.checked ? " checked" : "";
      return `<p><input type="checkbox" disabled${checked}> ${content}</p>`;
    case "toggle":
      return `<details><summary>${content}</summary></details>`;
    case "divider":
      return "<hr>";
    default:
      return content ? `<p>${content}</p>` : "";
  }
}

function wrapListItems(htmlParts) {
  const out = [];
  let inList = false;
  for (const part of htmlParts) {
    if (part.startsWith("<li>")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(part);
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(part);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

/**
 * Get full page content as HTML
 * @param {string} apiKey
 * @param {string} pageId
 * @returns {Promise<{ title: string, html: string, created_time: string }>}
 */
export async function getPageContent(apiKey, pageId) {
  const notion = new Client({ auth: apiKey });

  const [page, blocksRes] = await Promise.all([
    notion.pages.retrieve({ page_id: pageId }),
    notion.blocks.children.list({ block_id: pageId, page_size: 100 }),
  ]);

  const props = page.properties || {};
  let title = "Untitled";
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.title) {
      title = p.title.map((t) => t.plain_text).join("") || title;
      break;
    }
  }

  const created = page.created_time || new Date().toISOString();
  const htmlParts = [];
  let cursor = blocksRes.next_cursor;
  let results = blocksRes.results || [];

  do {
    for (const block of results) {
      if (block.type === "child_page" || block.type === "child_database") continue;
      const html = blockToHtml(block);
      if (html) htmlParts.push(html);
    }
    if (!cursor) break;
    const next = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    results = next.results || [];
    cursor = next.next_cursor;
  } while (cursor);

  const html = wrapListItems(htmlParts);
  return { title, html, created_time: created };
}
