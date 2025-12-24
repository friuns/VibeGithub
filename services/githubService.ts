import { GITHUB_API_BASE } from '../constants';
import { Repository, Issue, GitHubUser, IssueDraft, RepoDraft, Comment, WorkflowRun, Artifact, PullRequestDetails, Deployment, DeploymentStatus, WorkflowFile, RepoPublicKey, RepoSecret, GitHubTemplate } from '../types';
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

export const fetchGitHubTemplates = async (token: string, searchQuery?: string): Promise<GitHubTemplate[]> => {
  // Build search query - if user provides search, add it to the topic:template filter
  const query = searchQuery 
    ? `topic:template ${searchQuery}` 
    : 'topic:template';
  
  const response = await fetch(`${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=20`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }

  const data = await response.json();
  const items = data.items || [];
  
  // Map the API response to our GitHubTemplate interface
  return items.map((item: any) => ({
    name: item.name,
    owner: {
      login: item.owner.login,
    },
    description: item.description || '',
    stargazersCount: item.stargazers_count || 0,
  }));
};

export const createRepository = async (token: string, repo: RepoDraft): Promise<Repository> => {
  // If template_repository is provided, try template endpoint first, then clone via Actions as fallback
  if (repo.template_repository) {
    const [owner, repoName] = repo.template_repository.split('/');
    
    // Try template generation first
    const templateResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repoName}/generate`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repo.name,
        description: repo.description,
        private: repo.private,
        include_all_branches: false,
      }),
    });

    // If template generation succeeds, return the result
    if (templateResponse.ok) {
      return templateResponse.json();
    }

    // If template generation fails (e.g., OAuth restrictions), create repo with clone workflow
    console.warn(`Template generation failed for ${owner}/${repoName}, will clone via GitHub Actions instead`);
    
    // Create repository with auto_init to have a default branch
    const createResponse = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repo.name,
        description: repo.description,
        private: repo.private,
        auto_init: true, // Initialize with README so we have a default branch
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(`Failed to create repository: ${errorData.message || 'Unknown error'}`);
    }

      const newRepo = await createResponse.json();
      
      // Set the OAUTH_TOKEN secret so the workflow can push workflows
      try {
        await setRepositorySecret(token, newRepo.owner.login, newRepo.name, 'OAUTH_TOKEN', token);
      } catch (error) {
        console.warn('Failed to set OAUTH_TOKEN secret:', error);
      }
      
      // Create a workflow file that will clone the template repository
      const workflowContent = `name: Clone Template
on:
  workflow_dispatch:

jobs:
  clone:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout current repo
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.OAUTH_TOKEN || secrets.GITHUB_TOKEN }}
          fetch-depth: 0
          persist-credentials: true
          
      - name: Clone template repository
        run: |
          cd ..
          git clone --depth 1 https://github.com/${owner}/${repoName}.git temp-clone
          
      - name: Copy template files
        run: |
          # Remove existing files except .git
          find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
          
          # Copy all files from template (excluding .git)
          rsync -av --exclude='.git' ../temp-clone/ .
          
      - name: Commit and push template files
        env:
          GITHUB_TOKEN: \${{ secrets.OAUTH_TOKEN || secrets.GITHUB_TOKEN }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          
          # Check if there are changes to commit
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "Initialize from template: ${owner}/${repoName}"
            git push origin main --force
          fi
`;

    // Create .github/workflows directory and workflow file
    try {
      await createOrUpdateFile(
        token,
        newRepo.owner.login,
        newRepo.name,
        '.github/workflows/clone-template.yml',
        workflowContent,
        'Add workflow to clone template repository'
      );
      
      // Trigger the workflow
      await fetch(`${GITHUB_API_BASE}/repos/${newRepo.owner.login}/${newRepo.name}/actions/workflows/clone-template.yml/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: newRepo.default_branch || 'main',
        }),
      });
    } catch (error) {
      console.warn('Failed to create clone workflow:', error);
      // Don't fail the repo creation, just log the warning
    }
    
    return newRepo;
  }

  // Standard repository creation
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
 * Create or update a file in a repository
 */
const createOrUpdateFile = async (
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> => {
  // Encode content to base64
  const encodedContent = btoa(unescape(encodeURIComponent(content)));
  
  const body: any = {
    message,
    content: encodedContent,
  };
  
  // If SHA is provided, we're updating an existing file
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
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
    throw new Error(data?.message || 'Failed to create/update file');
  }
};

/**
 * Check if a file exists and get its SHA
 */
const getFileSha = async (
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        cache: 'no-cache',
      }
    );
    
    if (response.status === 404) {
      return null; // File doesn't exist
    }
    
    if (!response.ok) {
      throw new Error('Failed to check file');
    }
    
    const data = await response.json();
    return data.sha;
  } catch {
    return null;
  }
};

/**
 * Copy the setup.yml workflow and trigger it to setup the repository
 */
export const copySetupWorkflowAndRun = async (
  token: string,
  sourceOwner: string,
  sourceRepo: string,
  targetOwner: string,
  targetRepo: string
): Promise<void> => {
  const setupWorkflowPath = '.github/workflows/setup.yml';
  
  // Fetch the setup.yml content from source
  const content = await fetchWorkflowContent(token, sourceOwner, sourceRepo, setupWorkflowPath);
  
  // Check if file exists in target
  const existingSha = await getFileSha(token, targetOwner, targetRepo, setupWorkflowPath);
  
  // Create or update the setup.yml file
  const message = existingSha 
    ? `Update ${setupWorkflowPath} from ${sourceOwner}/${sourceRepo}`
    : `Add ${setupWorkflowPath} from ${sourceOwner}/${sourceRepo}`;
    
  await createOrUpdateFile(
    token,
    targetOwner,
    targetRepo,
    setupWorkflowPath,
    content,
    message,
    existingSha || undefined
  );
  
  // Wait for GitHub to process the commit and make the workflow available
  // We need to poll until the workflow is registered
  let workflowAvailable = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!workflowAvailable && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
    
    try {
      // Try to get the workflow to see if it's registered
      const checkResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${targetOwner}/${targetRepo}/actions/workflows/setup.yml`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (checkResponse.ok) {
        workflowAvailable = true;
      }
    } catch (err) {
      // Continue waiting
    }
  }
  
  if (!workflowAvailable) {
    throw new Error('Workflow setup.yml was not registered in time. Please trigger it manually from the Actions tab.');
  }
  
  // Get the default branch
  const defaultBranch = await getDefaultBranch(token, targetOwner, targetRepo);
  
  // Trigger the setup workflow
  const triggerResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${targetOwner}/${targetRepo}/actions/workflows/setup.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: defaultBranch,
      }),
    }
  );
  
  if (!triggerResponse.ok) {
    const errorData = await triggerResponse.json().catch(() => ({}));
    throw new Error(errorData?.message || 'Failed to trigger setup workflow. Please trigger it manually from the Actions tab.');
  }
};
