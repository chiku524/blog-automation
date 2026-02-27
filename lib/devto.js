/**
 * Publish article to Dev.to via API.
 * @see https://developers.forem.com/api/v1#tag/articles/operation/createArticle
 */

const DEVTO_API = "https://dev.to/api/articles";

/**
 * Publish a blog post to Dev.to
 * @param {object} opts
 * @param {string} opts.apiKey - Dev.to API key
 * @param {string} opts.title - Article title
 * @param {string} opts.bodyMarkdown - Article content (markdown)
 * @param {string} [opts.canonicalUrl] - Canonical URL (your blog)
 * @returns {Promise<object>} Created article
 */
export async function publishToDevto({ apiKey, title, bodyMarkdown, canonicalUrl }) {
  const res = await fetch(DEVTO_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      article: {
        title,
        body_markdown: bodyMarkdown,
        published: true,
        tags: ["devlog", "github", "weekly", "automation"],
        canonical_url: canonicalUrl || undefined,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dev.to API ${res.status}: ${err}`);
  }

  return res.json();
}
