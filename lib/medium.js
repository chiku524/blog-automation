/**
 * Publish article to Medium via API.
 * @see https://github.com/Medium/medium-api-docs
 * Auth: Integration token from Medium Settings → Security and apps → Integration tokens
 */

const MEDIUM_API = "https://api.medium.com/v1";

/**
 * Get authenticated user id (cached per token)
 * @param {string} token - Medium Integration token
 * @returns {Promise<string>} User id
 */
async function getMediumUserId(token) {
  const res = await fetch(`${MEDIUM_API}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Medium API /me ${res.status}: ${err}`);
  }
  const data = await res.json();
  const id = data?.data?.id;
  if (!id) throw new Error("Medium API /me did not return user id");
  return id;
}

/**
 * Publish a blog post to Medium
 * @param {object} opts
 * @param {string} opts.apiKey - Medium Integration token
 * @param {string} [opts.userId] - Medium user id (optional; fetched from /me if omitted)
 * @param {string} opts.title - Article title
 * @param {string} opts.bodyMarkdown - Article content (markdown)
 * @param {string} [opts.canonicalUrl] - Canonical URL (your blog)
 * @param {string} [opts.publishStatus] - "public" | "draft" | "unlisted" (default: "public")
 * @returns {Promise<object>} Created post { data: { id, url, ... } }
 */
export async function publishToMedium({
  apiKey,
  userId,
  title,
  bodyMarkdown,
  canonicalUrl,
  publishStatus = "public",
}) {
  const uid = userId || (await getMediumUserId(apiKey));
  const url = `${MEDIUM_API}/users/${uid}/posts`;

  const body = {
    title,
    contentFormat: "markdown",
    content: bodyMarkdown,
    publishStatus,
    license: "all-rights-reserved",
    ...(canonicalUrl && { canonicalUrl }),
    tags: ["devlog", "github", "weekly", "automation"],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Medium API ${res.status}: ${err}`);
  }

  return res.json();
}
