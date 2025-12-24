import { GITHUB_API_BASE } from '../constants';
import { Repository, Issue, GitHubUser, IssueDraft, RepoDraft, Comment, WorkflowRun, Artifact, PullRequestDetails, Deployment, DeploymentStatus, WorkflowFile, RepoPublicKey, RepoSecret } from '../types';
import _sodium from 'libsodium-wrappers';

export const validateToken = async (token: string): Promise<GitHubUser> => {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Invalid Personal Access Token');
  }

  return response.json();
};

export const fetchRepositories = async (token: string, page = 1): Promise<Repository[]> => {
  const response = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=12&page=${page}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch repositories');
  }

  return response.json();
};

export const createRepository = async (token: string, repo: RepoDraft): Promise<Repository> => {
  const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(repo),
  });

  if (!response.ok) {
    throw new Error('Failed to create repository');
  }

  return response.json();
};

export const fetchIssues = async (token: string, owner: string, repo: string): Promise<Issue[]> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=all&per_page=30&sort=updated&direction=desc`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch issues and pull requests');
  }

  return response.json();
};

export const fetchComments = async (token: string, owner: string, repo: string, issueNumber: number): Promise<Comment[]> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch comments');
  }

  return response.json();
};

export const createIssue = async (token: string, owner: string, repo: string, issue: IssueDraft): Promise<Issue> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(issue),
  });

  if (!response.ok) {
    throw new Error('Failed to create issue');
  }

  return response.json();
};

export const fetchWorkflowRuns = async (token: string, owner: string, repo: string): Promise<WorkflowRun[]> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=10`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch workflow runs');
  }

  const data = await response.json();
  return data.workflow_runs || [];
};

export const fetchArtifacts = async (token: string, owner: string, repo: string, runId: number): Promise<Artifact[]> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch artifacts');
  }

  const data = await response.json();
  return data.artifacts || [];
};

export const fetchPullRequestDetails = async (token: string, owner: string, repo: string, prNumber: number): Promise<PullRequestDetails> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch pull request details');
  }

  return response.json();
};

export const mergePullRequest = async (
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash'
): Promise<{ merged: boolean; message: string; sha?: string }> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ merge_method: mergeMethod }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to merge pull request');
  }

  return data;
};

export const createIssueComment = async (
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<Comment> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to create comment');
  }

  return response.json();
};

export const fetchDeploymentsBySha = async (token: string, owner: string, repo: string, sha: string): Promise<Deployment[]> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/deployments?sha=${encodeURIComponent(sha)}&per_page=10`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch deployments');
  }

  return response.json();
};

export const fetchDeploymentStatuses = async (token: string, owner: string, repo: string, deploymentId: number): Promise<DeploymentStatus[]> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/deployments/${deploymentId}/statuses?per_page=10`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch deployment statuses');
  }

  return response.json();
};

export const deleteRepository = async (token: string, owner: string, repo: string): Promise<void> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to delete repository');
  }
};

interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string;
  type: 'file' | 'dir';
}

export const fetchRepoWorkflowFiles = async (
  token: string,
  owner: string,
  repo: string
): Promise<WorkflowFile[]> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/.github/workflows`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    }
  );

  // 404 means no workflows directory exists - not an error
  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error('Failed to fetch workflow files');
  }

  const data: GitHubContentItem[] = await response.json();

  // Filter for .yml and .yaml files only
  return data
    .filter(
      (item) =>
        item.type === 'file' &&
        (item.name.endsWith('.yml') || item.name.endsWith('.yaml'))
    )
    .map((item) => ({
      ...item,
      type: 'file' as const,
      repoName: repo,
      repoOwner: owner,
      repoFullName: `${owner}/${repo}`,
    }));
};

export const fetchAllWorkflowFiles = async (
  token: string,
  repos: Repository[]
): Promise<WorkflowFile[]> => {
  const results = await Promise.allSettled(
    repos.map((repo) =>
      fetchRepoWorkflowFiles(token, repo.owner.login, repo.name)
    )
  );

  const allWorkflows: WorkflowFile[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allWorkflows.push(...result.value);
    }
  }

  return allWorkflows;
};

// ============ Repository Secrets API ============

/**
 * Fetch the public key for a repository (needed to encrypt secrets)
 */
export const fetchRepoPublicKey = async (
  token: string,
  owner: string,
  repo: string
): Promise<RepoPublicKey> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets/public-key`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch repository public key');
  }

  return response.json();
};

/**
 * Encrypt a secret value using the repository's public key
 * Uses libsodium sealed box encryption as required by GitHub
 */
export const encryptSecret = async (publicKey: string, secretValue: string): Promise<string> => {
  // Ensure libsodium is ready
  await _sodium.ready;
  const sodium = _sodium;
  
  // Decode the public key from base64
  const publicKeyBytes = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  
  // Encode the secret value as bytes
  const messageBytes = sodium.from_string(secretValue);
  
  // Encrypt using sealed box
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, publicKeyBytes);
  
  // Return as base64
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
};

/**
 * Create or update a repository secret
 */
export const setRepositorySecret = async (
  token: string,
  owner: string,
  repo: string,
  secretName: string,
  secretValue: string
): Promise<void> => {
  // First, get the repository's public key
  const publicKey = await fetchRepoPublicKey(token, owner, repo);
  
  // Encrypt the secret value
  const encryptedValue = await encryptSecret(publicKey.key, secretValue);
  
  // Create or update the secret
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets/${secretName}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id,
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to set repository secret');
  }
};

/**
 * List repository secrets (names only, values are not returned)
 */
export const fetchRepositorySecrets = async (
  token: string,
  owner: string,
  repo: string
): Promise<RepoSecret[]> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch repository secrets');
  }

  const data = await response.json();
  return data.secrets || [];
};

/**
 * Delete a repository secret
 */
export const deleteRepositorySecret = async (
  token: string,
  owner: string,
  repo: string,
  secretName: string
): Promise<void> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets/${secretName}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to delete repository secret');
  }
};

// ============ File Operations API ============

interface FileContent {
  content: string;
  sha: string;
}

/**
 * Fetch the content of a file from a repository
 */
export const fetchFileContent = async (
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<FileContent> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch file content');
  }

  const data = await response.json();

  // Decode base64 content
  const content = atob(data.content.replace(/\n/g, ''));

  return {
    content,
    sha: data.sha,
  };
};

/**
 * Create or update a file in a repository
 */
export const createOrUpdateFile = async (
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> => {
  const body: any = {
    message,
    content: btoa(content), // Encode to base64
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to create or update file');
  }
};

/**
 * Copy workflows from friuns/VibeGithub to a target repository
 */
export const copyVibeGithubWorkflows = async (
  token: string,
  targetOwner: string,
  targetRepo: string
): Promise<void> => {
  // Fetch workflow files from friuns/VibeGithub
  const sourceWorkflows = await fetchRepoWorkflowFiles(token, 'friuns', 'VibeGithub');

  // Copy each workflow file
  for (const workflow of sourceWorkflows) {
    try {
      // Fetch the content of the source workflow
      const { content } = await fetchFileContent(token, 'friuns', 'VibeGithub', workflow.path);

      // Try to get the current file in target repo to check if it exists
      let existingSha: string | undefined;
      try {
        const existing = await fetchFileContent(token, targetOwner, targetRepo, workflow.path);
        existingSha = existing.sha;
      } catch (err) {
        // File doesn't exist, that's fine
      }

      // Create or update the file in target repo
      const message = existingSha
        ? `Update workflow: ${workflow.name}`
        : `Add workflow: ${workflow.name}`;

      await createOrUpdateFile(
        token,
        targetOwner,
        targetRepo,
        workflow.path,
        content,
        message,
        existingSha
      );
    } catch (err) {
      console.error(`Failed to copy workflow ${workflow.name}:`, err);
      throw new Error(`Failed to copy workflow ${workflow.name}: ${err.message}`);
    }
  }
};
