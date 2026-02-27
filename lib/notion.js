/**
 * Creates a Notion page with the generated blog post content.
 * Converts markdown to Notion blocks.
 */

import { Client } from "@notionhq/client";

/**
 * Convert markdown string to Notion blocks
 * @param {string} markdown
 * @returns {object[]}
 */
function markdownToNotionBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const toRichText = (text) => {
      const parts = [];
      const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
      let lastIdx = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        if (m.index > lastIdx) {
          parts.push({ type: "text", text: { content: text.slice(lastIdx, m.index) } });
        }
        const content = m[1] ?? m[2];
        const annotations = m[1] ? { bold: true } : { code: true };
        parts.push({ type: "text", text: { content }, annotations });
        lastIdx = m.index + m[0].length;
      }
      if (lastIdx < text.length) {
        parts.push({ type: "text", text: { content: text.slice(lastIdx) } });
      }
      return parts.length ? parts : [{ type: "text", text: { content: text } }];
    };

    if (trimmed.startsWith("### ")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: toRichText(trimmed.slice(4)) },
      });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: toRichText(trimmed.slice(3)) },
      });
    } else if (trimmed.startsWith("# ")) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: toRichText(trimmed.slice(2)) },
      });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: toRichText(trimmed.slice(2)) },
      });
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: toRichText(trimmed.replace(/^\d+\.\s/, "")) },
      });
    } else if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "plain text";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: codeLines.join("\n") } }],
          language: lang,
        },
      });
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: toRichText(trimmed) },
      });
    }
    i++;
  }

  return blocks;
}

/**
 * Create a Notion page with blog content
 * @param {object} opts
 * @param {string} opts.apiKey - Notion internal integration secret
 * @param {string} opts.parentId - Page or database ID
 * @param {string} opts.title - Page title
 * @param {string} opts.content - Markdown content
 * @param {boolean} opts.isDatabase - If parent is a database
 * @returns {Promise<object>} Created page
 */
export async function createNotionPage({
  apiKey,
  parentId,
  title,
  content,
  isDatabase = false,
}) {
  const notion = new Client({ auth: apiKey });
  const children = markdownToNotionBlocks(content);

  const parent = isDatabase
    ? { database_id: parentId }
    : { page_id: parentId };

  const properties = isDatabase
    ? {
        title: {
          title: [{ type: "text", text: { content: title } }],
        },
      }
    : {
        title: {
          title: [{ type: "text", text: { content: title } }],
        },
      };

  const body = {
    parent,
    properties,
    children: children.slice(0, 100),
  };

  const page = await notion.pages.create(body);

  // Notion allows max 100 blocks per request; append rest in chunks
  if (children.length > 100) {
    const blockId = page.id;
    for (let offset = 100; offset < children.length; offset += 100) {
      const chunk = children.slice(offset, offset + 100);
      await notion.blocks.children.append({
        block_id: blockId,
        children: chunk,
      });
    }
  }

  return page;
}
