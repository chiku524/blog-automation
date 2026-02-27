/**
 * Fetches repository activity (commits) from the past week.
 * Used to filter which repos had meaningful activity for the weekly blog.
 */

const GITHUB_API = "https://api.github.com";

/**
 * Get commits for a repo since a given date
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @param {string} token - GitHub PAT
 * @param {Date} since - ISO date string
 * @returns {Promise<{ commits: object[], hasActivity: boolean }>}
 */
export async function getRepoActivity(owner, repo, token, since) {
  const sinceISO = since.toISOString();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/commits?since=${sinceISO}&per_page=100`;

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
  const hasActivity = Array.isArray(commits) && commits.length > 0;

  return {
    commits: commits || [],
    hasActivity,
    repo: { owner, repo },
  };
}

/**
 * Get activity summary for multiple repos
 * @param {Array<{ owner: string, repo: string, description?: string }>} repos
 * @param {string} token
 * @param {Date} since
 * @returns {Promise<Array<{ owner: string, repo: string, description?: string, commits: object[], hasActivity: boolean }>>}
 */
export async function getActivityForRepos(repos, token, since) {
  const results = await Promise.all(
    repos.map(async (r) => {
      const { commits, hasActivity } = await getRepoActivity(
        r.owner,
        r.repo,
        token,
        since
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
