/**
 * Post tweets to X (Twitter) via API v2 with OAuth 1.0a user context.
 * Each account uses env vars: {envPrefix}_API_KEY, _API_SECRET, _ACCESS_TOKEN, _ACCESS_SECRET.
 * Uses dynamic import to avoid "Cannot access before initialization" in Vercel serverless.
 * @see https://developer.x.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
 */

/**
 * Load credentials for one account from env using the given prefix.
 * e.g. envPrefix "TWITTER_BOING" → TWITTER_BOING_API_KEY, TWITTER_BOING_API_SECRET, ...
 * @param {string} envPrefix - Prefix for env vars (e.g. "TWITTER" or "TWITTER_BOING")
 * @returns {{ apiKey: string, apiSecret: string, accessToken: string, accessSecret: string } | null}
 */
export function getTwitterCredentials(envPrefix) {
  if (!envPrefix || typeof envPrefix !== "string") return null;
  const prefix = envPrefix.replace(/\s+/g, "_").toUpperCase();
  const apiKey = process.env[`${prefix}_API_KEY`] || process.env[`${prefix}_CONSUMER_KEY`];
  const apiSecret = process.env[`${prefix}_API_SECRET`] || process.env[`${prefix}_CONSUMER_SECRET`];
  const accessToken = process.env[`${prefix}_ACCESS_TOKEN`];
  const accessSecret = process.env[`${prefix}_ACCESS_SECRET`];

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return null;
  }
  return { apiKey, apiSecret, accessToken, accessSecret };
}

/**
 * Post a tweet with the given credentials (OAuth 1.0a user context).
 * @param {object} credentials - From getTwitterCredentials()
 * @param {string} text - Tweet text (max 280 chars for non-blue accounts)
 * @returns {Promise<{ id: string, text: string }>}
 */
export async function postTweet(credentials, text) {
  const { TwitterApi } = await import("twitter-api-v2");
  const client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessSecret,
  });

  const tweet = await client.v2.tweet(text);
  return {
    id: tweet.data.id,
    text: tweet.data.text,
  };
}
