/**
 * Vercel serverless function – posts one tweet per configured Twitter account.
 * Triggered by cron 3–4 times per week (see vercel.json) or manually.
 * Auth: TWITTER_CRON_SECRET if set, otherwise CRON_SECRET.
 * When no message is provided, generates a playful/professional tweet per account (project pitch or recent commits).
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { getTwitterCredentials, postTweet } from "../lib/twitter.js";
import { generateTweetForProject } from "../lib/ai.js";
import { getRepoActivity, getCommitMessage } from "../lib/github.js";

function getEnvOptional(name) {
  return process.env[name] || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.TWITTER_CRON_SECRET || process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || req.query?.secret || "";
    const provided = auth.replace(/^Bearer\s+/i, "") || req.query?.secret;
    if (provided !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const configPath = join(process.cwd(), "config", "twitter.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const accounts = config.accounts || [];

    if (!accounts.length) {
      return res.status(200).json({
        ok: true,
        message: "No Twitter accounts configured",
        posted: [],
      });
    }

    const bodyMessage =
      req.method === "POST" && req.body && typeof req.body.message === "string"
        ? req.body.message.trim()
        : null;
    const defaultMessage = process.env.TWITTER_DEFAULT_MESSAGE || null;
    const githubToken = getEnvOptional("GITHUB_TOKEN");
    const openaiKey = getEnvOptional("OPENAI_API_KEY");

    const results = [];
    for (const account of accounts) {
      const { id, label, envPrefix, projectUrl, projectDescription, owner, repo } = account;
      const creds = getTwitterCredentials(envPrefix);
      if (!creds) {
        results.push({ id, label, status: "skipped", reason: "missing credentials" });
        continue;
      }

      let message =
        bodyMessage ||
        defaultMessage ||
        getEnvOptional(`${(envPrefix || "TWITTER").replace(/\s+/g, "_").toUpperCase()}_DEFAULT_MESSAGE");

      if (!message && projectUrl && projectDescription && openaiKey) {
        let recentCommitMessages = [];
        if (owner && repo && githubToken) {
          const since = new Date();
          since.setDate(since.getDate() - 7);
          since.setUTCHours(0, 0, 0, 0);
          try {
            const { commits } = await getRepoActivity(owner, repo, githubToken, since);
            recentCommitMessages = (commits || []).slice(0, 5).map((c) => getCommitMessage(c));
          } catch (_) {
            /* ignore GitHub errors */
          }
        }
        try {
          message = await generateTweetForProject({
            projectName: label,
            projectDescription,
            projectUrl,
            recentCommitMessages,
            apiKey: openaiKey,
          });
        } catch (err) {
          results.push({ id, label, status: "error", error: `Tweet generation: ${err.message}` });
          continue;
        }
      }

      if (!message) {
        results.push({ id, label, status: "skipped", reason: "no message (set default or add projectUrl/Description + OPENAI_API_KEY)" });
        continue;
      }

      try {
        const tweet = await postTweet(creds, message.slice(0, 280));
        results.push({ id, label, status: "posted", tweetId: tweet.id, text: message.slice(0, 80) + (message.length > 80 ? "…" : "") });
      } catch (err) {
        results.push({ id, label, status: "error", error: err.message || String(err) });
      }
    }

    return res.status(200).json({
      ok: true,
      posted: results.filter((r) => r.status === "posted"),
      results,
    });
  } catch (err) {
    console.error("Twitter posts error:", err);
    return res.status(500).json({
      error: err.message || "Twitter posts failed",
    });
  }
}
