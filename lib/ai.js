/**
 * Generates blog post content using OpenAI.
 * Tone: professional, intelligent, and humorous.
 */

import OpenAI from "openai";

const DEFAULT_SYSTEM_PROMPT = `You are a talented technical writer who creates engaging weekly development digests.
Your style is:
- Professional and insightful — you explain technical decisions clearly
- Intelligent — you connect dots, spot patterns, and provide genuine value
- Humorous — you use wit, playful metaphors, and the occasional dev joke without being unprofessional
- Concise — you respect the reader's time; no fluff

Output clean markdown. Use headers (##, ###), paragraphs, bullet points, and code snippets when appropriate.`;

/**
 * Generate a weekly blog post about active repos
 * @param {object} opts
 * @param {Array<{ owner: string, repo: string, description?: string, commits: object[], hasActivity: boolean }>} opts.activeRepos
 * @param {string} opts.weekLabel - e.g. "Feb 21–27, 2025"
 * @param {string} opts.apiKey - OpenAI API key
 * @returns {Promise<string>} Markdown content
 */
export async function generateBlogPost({ activeRepos, weekLabel, apiKey }) {
  const client = new OpenAI({ apiKey });

  const reposWithActivity = activeRepos.filter((r) => r.hasActivity);

  if (reposWithActivity.length === 0) {
    return generateQuietWeekPost(weekLabel);
  }

  const repoContext = reposWithActivity
    .map((r) => {
      const desc = r.description ? ` (${r.description})` : "";
      const commitCount = r.commits?.length || 0;
      const sampleMessages = (r.commits || [])
        .slice(0, 5)
        .map((c) => c.commit?.message || "n/a")
        .join("\n  - ");
      return `- **${r.owner}/${r.repo}**${desc}\n  Commits: ${commitCount}\n  Sample messages:\n  - ${sampleMessages}`;
    })
    .join("\n\n");

  const userPrompt = `Write a weekly dev digest blog post for the week of **${weekLabel}**.

These repositories had activity this week:

${repoContext}

Requirements:
- Title: something catchy and relevant (e.g., "Shipping Season" or "The Week the Codebase Learned to Talk")
- Opening: hook the reader with a brief intro
- For each repo: a short, insightful section on what shipped (infer from commit messages). Be specific and witty when possible.
- Closing: a brief wrap-up or forward-looking thought
- Keep it under ~600 words total
- Use markdown: ## for main headers, ### for subheaders, **bold** for emphasis, \`code\` for tech terms
- Tone: professional, smart, and lightly humorous. No corporate-speak.`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: DEFAULT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned empty content");
  return content;
}

function generateQuietWeekPost(weekLabel) {
  return `## A Quiet Week (${weekLabel})

Sometimes the best code is the code you *don't* write.

This week, the repositories remained still — no commits, no merges, no midnight debugging sessions. Perhaps the team was planning. Perhaps they were shipping something so monumental it defies version control. Or perhaps they finally took that vacation.

Either way, we'll be back next week with more updates. Stay tuned.`;
}

/**
 * Generate a daily generic blog post (all repos, last 24h activity).
 * @param {object} opts
 * @param {Array<{ owner: string, repo: string, description?: string, commits: object[], hasActivity: boolean }>} opts.activeRepos
 * @param {string} opts.dayLabel - e.g. "Mar 2, 2026"
 * @param {string} opts.apiKey - OpenAI API key
 * @returns {Promise<string>} Markdown content
 */
export async function generateDailyBlogPost({ activeRepos, dayLabel, apiKey }) {
  const client = new OpenAI({ apiKey });
  const reposWithActivity = activeRepos.filter((r) => r.hasActivity);

  if (reposWithActivity.length === 0) {
    return `## A Quiet Day (${dayLabel})

No commits across the repos today. The codebase is resting — we'll be back with more soon.`;
  }

  const repoContext = reposWithActivity
    .map((r) => {
      const desc = r.description ? ` (${r.description})` : "";
      const commitCount = r.commits?.length || 0;
      const sampleMessages = (r.commits || [])
        .slice(0, 5)
        .map((c) => c.commit?.message || "n/a")
        .join("\n  - ");
      return `- **${r.owner}/${r.repo}**${desc}\n  Commits: ${commitCount}\n  Sample messages:\n  - ${sampleMessages}`;
    })
    .join("\n\n");

  const userPrompt = `Write a short daily dev digest blog post for **${dayLabel}** (today's activity across all repos).

These repositories had activity in the last 24 hours:

${repoContext}

Requirements:
- Title: something catchy and day-focused (e.g., "Today's Ship Log" or "What Shipped Today")
- Opening: one short sentence hook
- For each repo: one or two sentences on what shipped (infer from commit messages). Be specific and punchy.
- Closing: one brief line
- Keep it under ~300 words total
- Use markdown: ## for main headers, ### for subheaders, **bold** for emphasis
- Tone: professional, smart, and lightly humorous.`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: DEFAULT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned empty content");
  return content;
}

/**
 * Generate a per-repo blog post (either activity-based or quiet week for that repo)
 * @param {object} opts
 * @param {{ owner: string, repo: string, description?: string, commits: object[], hasActivity: boolean }} opts.repo - Single repo with activity
 * @param {string} opts.weekLabel - e.g. "Feb 21–27, 2025"
 * @param {string} opts.apiKey - OpenAI API key
 * @returns {Promise<string>} Markdown content
 */
export async function generateRepoBlogPost({ repo, weekLabel, apiKey }) {
  const client = new OpenAI({ apiKey });
  const slug = `${repo.owner}/${repo.repo}`;
  const desc = repo.description ? ` (${repo.description})` : "";

  if (!repo.hasActivity) {
    return `## ${repo.repo}: A Quiet Week (${weekLabel})

No commits this week for **${slug}**${desc}.

Sometimes the best progress is the progress you *don't* ship — planning, refactoring in your head, or just taking a breath before the next sprint. We'll be back with updates when the code starts flowing again.`;
  }

  const commitCount = repo.commits?.length || 0;
  const sampleMessages = (repo.commits || [])
    .slice(0, 8)
    .map((c) => c.commit?.message || "n/a")
    .join("\n  - ");

  const userPrompt = `Write a short weekly dev digest blog post for **${slug}**${desc} for the week of **${weekLabel}**.

This repository had ${commitCount} commit(s) this week. Sample commit messages:
  - ${sampleMessages}

Requirements:
- Title: something catchy and specific to this repo (e.g., "blog-automation: Shipping the Pipeline" or "VibeMiner Gets a Makeover")
- Opening: brief hook for this repo
- One or two short sections on what shipped (infer from commit messages). Be specific and witty.
- Closing: brief wrap-up or teaser for next week
- Keep it under ~250 words
- Use markdown: ## for main headers, ### for subheaders, **bold** for emphasis
- Tone: professional, smart, and lightly humorous.`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: DEFAULT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned empty content");
  return content;
}
