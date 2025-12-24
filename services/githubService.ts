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

// ============ Workflow Copy from Reference Repository ============

/**
 * Fetch workflow files from the reference repository
 */
export const fetchReferenceWorkflows = async (
  token: string,
  referenceOwner = 'friuns',
  referenceRepo = 'VibeGithub'
): Promise<WorkflowFile[]> => {
  return fetchRepoWorkflowFiles(token, referenceOwner, referenceRepo);
};

/**
 * Fetch the content of a specific workflow file
 */
export const fetchWorkflowContent = async (
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3.raw',
      },
      cache: 'no-cache',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch workflow content');
  }

  return response.text();
};

/**
 * Get the default branch of a repository
 */
export const getDefaultBranch = async (
  token: string,
  owner: string,
  repo: string
): Promise<string> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch repository info');
  }

  const data = await response.json();
  return data.default_branch;
};

/**
 * Get the latest commit SHA for a branch
 */
export const getLatestCommitSha = async (
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch branch reference');
  }

  const data = await response.json();
  return data.object.sha;
};

/**
 * Create a blob (file content) in the repository
 */
export const createBlob = async (
  token: string,
  owner: string,
  repo: string,
  content: string
): Promise<string> => {
  const encodedContent = btoa(unescape(encodeURIComponent(content)));
  
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: encodedContent,
        encoding: 'base64',
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to create blob');
  }

  const data = await response.json();
  return data.sha;
};

/**
 * Create a tree with multiple files
 */
export const createTree = async (
  token: string,
  owner: string,
  repo: string,
  baseTreeSha: string,
  files: Array<{ path: string; sha: string }>
): Promise<string> => {
  const tree = files.map(file => ({
    path: file.path,
    mode: '100644',
    type: 'blob',
    sha: file.sha,
  }));

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree,
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to create tree');
  }

  const data = await response.json();
  return data.sha;
};

/**
 * Create a commit
 */
export const createCommit = async (
  token: string,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: [parentSha],
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to create commit');
  }

  const data = await response.json();
  return data.sha;
};

/**
 * Update a branch reference to point to a new commit
 */
export const updateBranchRef = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  commitSha: string
): Promise<void> => {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: commitSha,
        force: false,
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to update branch reference');
  }
};

/**
 * Copy all workflows from source repository to target repository in a single commit
 */
export const copyAllWorkflowsInOneCommit = async (
  token: string,
  sourceOwner: string,
  sourceRepo: string,
  targetOwner: string,
  targetRepo: string,
  workflows: WorkflowFile[]
): Promise<void> => {
  // Get the default branch
  const defaultBranch = await getDefaultBranch(token, targetOwner, targetRepo);
  
  // Get the latest commit SHA
  const latestCommitSha = await getLatestCommitSha(token, targetOwner, targetRepo, defaultBranch);
  
  // Get the base tree from the latest commit
  const commitResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${targetOwner}/${targetRepo}/git/commits/${latestCommitSha}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  
  if (!commitResponse.ok) {
    throw new Error('Failed to fetch commit details');
  }
  
  const commitData = await commitResponse.json();
  const baseTreeSha = commitData.tree.sha;
  
  // Fetch and create blobs for all workflow files
  const fileBlobs: Array<{ path: string; sha: string }> = [];
  
  for (const workflow of workflows) {
    const content = await fetchWorkflowContent(token, sourceOwner, sourceRepo, workflow.path);
    const blobSha = await createBlob(token, targetOwner, targetRepo, content);
    fileBlobs.push({ path: workflow.path, sha: blobSha });
  }
  
  // Create a new tree with all the files
  const treeSha = await createTree(token, targetOwner, targetRepo, baseTreeSha, fileBlobs);
  
  // Create a commit with the new tree
  const commitMessage = `Add ${workflows.length} workflows from ${sourceOwner}/${sourceRepo}

Workflows added:
${workflows.map(w => `- ${w.name}`).join('\n')}`;
  
  const newCommitSha = await createCommit(
    token,
    targetOwner,
    targetRepo,
    commitMessage,
    treeSha,
    latestCommitSha
  );
  
  // Update the branch to point to the new commit
  await updateBranchRef(token, targetOwner, targetRepo, defaultBranch, newCommitSha);
};

/**
 * Enable GitHub Pages for a repository with GitHub Actions as the source
 */
export const enableGitHubPages = async (
  token: string,
  owner: string,
  repo: string
): Promise<void> => {
  // First, try to create/update Pages configuration
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/pages`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        build_type: 'workflow',
      }),
    }
  );

  // If pages already exists, try to update it
  if (response.status === 409) {
    const updateResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pages`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          build_type: 'workflow',
        }),
      }
    );
    
    if (!updateResponse.ok) {
      throw new Error('Failed to update GitHub Pages configuration');
    }
    return;
  }

  if (!response.ok) {
    throw new Error('Failed to enable GitHub Pages');
  }
};
