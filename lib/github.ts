const COMMIT_URL_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{4,40})$/i;
const SHORTHAND_RE = /^([^/\s]+)\/([^@\s]+)@([a-f0-9]{4,40})$/i;

const MAX_DIFF_CHARS = 15_000;

export interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CommitData {
  sha: string;
  message: string;
  author: {
    name: string;
    login: string;
    avatarUrl: string;
    date: string;
  };
  stats: { additions: number; deletions: number; total: number };
  files: CommitFile[];
  diff: string;
  htmlUrl: string;
  repoUrl: string;
}

export function parseCommitInput(
  input: string
): { owner: string; repo: string; sha: string } | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(COMMIT_URL_RE);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], sha: urlMatch[3] };
  }
  const shortMatch = trimmed.match(SHORTHAND_RE);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2], sha: shortMatch[3] };
  }
  return null;
}

export async function fetchCommitData(
  owner: string,
  repo: string,
  sha: string
): Promise<CommitData> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "CodeReview-AI",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });

  if (res.status === 404) {
    throw new GitHubError(
      "Commit not found (if private, set GITHUB_TOKEN)",
      422
    );
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new GitHubError(
        "GitHub rate limit exceeded. Add GITHUB_TOKEN for higher limits.",
        422
      );
    }
    throw new GitHubError("GitHub API access forbidden", 422);
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error: ${res.status}`, 422);
  }

  const data = await res.json();
  const commit = data.commit;
  const author = commit.author;

  const files: CommitFile[] = (data.files ?? []).map(
    (f: Record<string, unknown>) => ({
      filename: f.filename as string,
      status: f.status as string,
      additions: (f.additions as number) ?? 0,
      deletions: (f.deletions as number) ?? 0,
      patch: f.patch as string | undefined,
    })
  );

  return {
    sha: data.sha,
    message: commit.message,
    author: {
      name: author.name ?? data.author?.login ?? "Unknown",
      login: data.author?.login ?? "",
      avatarUrl: data.author?.avatar_url ?? "",
      date: author.date,
    },
    stats: {
      additions: data.stats?.additions ?? 0,
      deletions: data.stats?.deletions ?? 0,
      total: data.stats?.total ?? 0,
    },
    files,
    diff: buildDiffText(files),
    htmlUrl: data.html_url,
    repoUrl: `https://github.com/${owner}/${repo}`,
  };
}

export function buildDiffText(files: CommitFile[]): string {
  const parts: string[] = [];
  let totalLen = 0;

  for (const file of files) {
    if (!file.patch) continue;

    const header = `--- a/${file.filename}\n+++ b/${file.filename}\n`;
    const section = header + file.patch + "\n";

    if (totalLen + section.length > MAX_DIFF_CHARS) {
      const remaining = MAX_DIFF_CHARS - totalLen;
      if (remaining > 100) {
        parts.push(section.slice(0, remaining));
      }
      parts.push(
        `\n... diff truncated (${files.length - parts.length} more files)`
      );
      break;
    }

    parts.push(section);
    totalLen += section.length;
  }

  return parts.join("\n") || "(no diff content available)";
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}
