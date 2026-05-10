type GitHubFile = {
  content: string;
  sha: string;
};

export function hasGitHubWriteAccess() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
}

export async function readPublicJsonFile<T>(path: string): Promise<T | null> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) return null;

  const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`, {
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) return null;

  return (await response.json()) as T;
}

export async function writeJsonFile(path: string, value: unknown, message: string) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    throw new Error("Missing GITHUB_TOKEN, GITHUB_OWNER or GITHUB_REPO");
  }

  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const current = await getGitHubFile(endpoint, token);
  const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8").toString("base64");

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message,
      content,
      sha: current?.sha,
      branch: "main",
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub file update failed: ${await response.text()}`);
  }
}

async function getGitHubFile(endpoint: string, token: string): Promise<GitHubFile | null> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub file read failed: ${await response.text()}`);
  }

  return (await response.json()) as GitHubFile;
}
