/**
 * Fetches repository activity (commits) from the past week.
 * Used to filter which repos had meaningful activity for the weekly blog.
 */

const GITHUB_API = "https://api.github.com";
const PER_PAGE = 100;

/**
 * Extract commit message from a GitHub API commit item (list commits response).
 * Handles both nested commit.message and any API shape quirks.
 * @param {object} c - Commit item from GET /repos/{owner}/{repo}/commits
 * @returns {string}
 */
export function getCommitMessage(c) {
  if (!c) return "n/a";
  const msg = (c.commit && c.commit.message) || c.message;
  const s = typeof msg === "string" ? msg.trim() : "";
  return s || "n/a";
}

/**
 * Returns the date range and label for the current weekly report.
 * Aligns "since" with the week label so commits match the reported week.
 * @returns {{ since: Date, weekLabel: string }}
 */
export function getWeeklyReportWindow() {
  const now = new Date();
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  const lastFriday = new Date(now);
  lastFriday.setDate(now.getDate() - diff);
  const prevFriday = new Date(lastFriday);
  prevFriday.setDate(lastFriday.getDate() - 7);
  prevFriday.setUTCHours(0, 0, 0, 0);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const weekLabel = `${fmt(prevFriday)} – ${fmt(lastFriday)}`;
  return { since: prevFriday, weekLabel };
}

/**
 * Get commits for a repo since a given date (with pagination so all commits are fetched).
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @param {string} token - GitHub PAT
 * @param {Date} since - Start date (inclusive), UTC
 * @param {Date} [until] - End date (exclusive); only commits before this time. Omit for no upper bound.
 * @returns {Promise<{ commits: object[], hasActivity: boolean }>}
 */
export async function getRepoActivity(owner, repo, token, since, until) {
  const sinceISO = since.toISOString();
  const allCommits = [];
  let page = 1;

  for (;;) {
    let url = `${GITHUB_API}/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=${PER_PAGE}&page=${page}`;
    if (until) {
      url += `&until=${until.toISOString()}`;
    }
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${err}`);
    }

    const commits = await res.json();
    if (!Array.isArray(commits)) break;
    allCommits.push(...commits);
    if (commits.length < PER_PAGE) break;
    page += 1;
  }

  const hasActivity = allCommits.length > 0;
  return {
    commits: allCommits,
    hasActivity,
    repo: { owner, repo },
  };
}

/**
 * Get activity summary for multiple repos
 * @param {Array<{ owner: string, repo: string, description?: string }>} repos
 * @param {string} token
 * @param {Date} since
 * @param {Date} [until] - Optional end date (exclusive) for commit window
 * @returns {Promise<Array<{ owner: string, repo: string, description?: string, commits: object[], hasActivity: boolean }>>}
 */
export async function getActivityForRepos(repos, token, since, until) {
  const results = await Promise.all(
    repos.map(async (r) => {
      const { commits, hasActivity } = await getRepoActivity(
        r.owner,
        r.repo,
        token,
        since,
        until
      );
      return {
        ...r,
        commits,
        hasActivity,
      };
    })
  );
  return results;
}
