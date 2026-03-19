/**
 * Theme resolution for blog posts.
 * Loads config/themes.json and resolves theme by id or post type.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached = null;

function loadThemes() {
  if (cached) return cached;
  const path = join(__dirname, "..", "config", "themes.json");
  cached = JSON.parse(readFileSync(path, "utf-8"));
  return cached;
}

/**
 * Get theme config by id
 * @param {string} themeId - e.g. "weekly", "daily", "default"
 * @returns {{ emoji: string, label: string } | null}
 */
export function getTheme(themeId) {
  if (!themeId) return null;
  const { themes } = loadThemes();
  const theme = themes[themeId];
  return theme ? { emoji: theme.emoji, label: theme.label } : null;
}

/**
 * Resolve theme for a post
 * @param {object} opts
 * @param {"weekly"|"daily"} [opts.type] - "weekly" | "daily" for generic posts
 * @param {{ theme?: string }} [opts.repo] - repo config (optional theme override)
 * @param {string} [opts.defaultTheme] - from config.defaultTheme
 * @returns {string} theme id to pass to createNotionPage
 */
export function getThemeForPost({ type, repo, defaultTheme }) {
  if (type === "weekly") return "weekly";
  if (type === "daily") return "daily";
  const repoTheme = repo?.theme;
  if (repoTheme) return repoTheme;
  return defaultTheme || "default";
}
