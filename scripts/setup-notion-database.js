#!/usr/bin/env node
/**
 * Review the Notion blog database: ensure schema is complete for blog automation.
 * Run: npm run setup-notion-db (or node scripts/setup-notion-database.js [database_id])
 *
 * Required for blog automation:
 * - A title property (Notion default "Name" or "title") for post titles
 * - A "Feed" property (rich_text) for per-repo / generic feed filtering
 */

import "dotenv/config";
import { Client } from "@notionhq/client";

const FEED_PROPERTY_NAME = "Feed";

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  const dbIdFromEnv = process.env.NOTION_BLOG_PARENT_ID;
  const dbIdArg = process.argv[2];
  const databaseId = (dbIdArg || dbIdFromEnv || "").replace(/-/g, "");

  if (!apiKey || !databaseId) {
    console.error("Usage: node scripts/setup-notion-database.js [database_id]");
    console.error("Or set NOTION_API_KEY and NOTION_BLOG_PARENT_ID in .env");
    process.exit(1);
  }

  const notion = new Client({ auth: apiKey });

  console.log("Fetching database...\n");
  let db;
  try {
    db = await notion.databases.retrieve({ database_id: databaseId });
  } catch (err) {
    console.error("Failed to fetch database:", err.message);
    if (err.code === "object_not_found") {
      console.error("Share the database with your Notion integration (⋯ → Add connections).");
    }
    process.exit(1);
  }

  const title = db.title?.map((t) => t.plain_text).join("") || "Untitled";
  const props = db.properties || {};
  const propNames = Object.keys(props);

  console.log("Database: \"%s\"", title);
  console.log("ID: %s\n", databaseId);
  console.log("Properties:");
  let hasTitleProp = false;
  let hasFeedProp = false;
  let feedType = null;

  for (const [name, schema] of Object.entries(props)) {
    const type = schema.type || "?";
    console.log("  - %s (%s)", name, type);
    if (type === "title") hasTitleProp = true;
    if (name === FEED_PROPERTY_NAME) {
      hasFeedProp = true;
      feedType = type;
    }
  }

  console.log("");
  const issues = [];
  if (!hasTitleProp) {
    issues.push("Missing a title property. Notion databases need one property of type 'title' (e.g. 'Name') for page titles.");
  }
  if (!hasFeedProp) {
    issues.push('Missing "Feed" property (required for per-repo / generic feed filtering).');
  } else if (feedType !== "rich_text") {
    issues.push(`"Feed" exists but is type "${feedType}". Blog automation expects rich_text.`);
  }

  if (issues.length > 0) {
    console.log("Issues:");
    issues.forEach((i) => console.log("  • " + i));
    if (!hasFeedProp) {
      console.log("\nAdding \"Feed\" (rich_text)...");
      try {
        await notion.databases.update({
          database_id: databaseId,
          properties: {
            [FEED_PROPERTY_NAME]: { rich_text: {} },
          },
        });
        console.log("Done. \"Feed\" property added.");
        hasFeedProp = true;
      } catch (err) {
        console.error("Failed to add Feed property:", err.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  console.log("\n--- Summary ---");
  if (hasTitleProp && hasFeedProp && feedType === "rich_text") {
    console.log("Database is ready for blog automation.");
    console.log("  • Title property: present (post titles)");
    console.log("  • Feed property: present (rich_text, for feed filtering)");
    console.log("\nSet NOTION_PARENT_TYPE=database in .env and run npm run generate (or rely on the Friday cron).");
  } else {
    console.log("Database may not be fully ready. Address the issues above.");
    process.exit(1);
  }
}

main();
