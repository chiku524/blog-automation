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
