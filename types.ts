export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  stargazers_count: number;
  language: string;
  updated_at: string;
  open_issues_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  html_url: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  html_url: string;
  labels: {
    id: number;
    name: string;
    color: string;
  }[];
  pull_request?: {
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
  };
  comments?: number;
  comments_url?: string;
}

export interface Comment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  html_url: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  html_url: string;
  merged_at: string | null;
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
}

export interface PullRequestDetails {
  number: number;
  title: string;
  html_url: string;
  state?: 'open' | 'closed';
  merged?: boolean;
  merged_at?: string | null;
  head: {
    ref: string;
    sha: string;
  };
}

export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  event: string;
}

export interface Artifact {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
  expired: boolean;
  expires_at: string;
  archive_download_url: string;
}

export interface Deployment {
  id: number;
  sha: string;
  ref: string;
  task: string;
  environment: string;
  description: string | null;
  created_at: string;
}

export interface DeploymentStatus {
  id: number;
  state: 'error' | 'failure' | 'inactive' | 'in_progress' | 'queued' | 'pending' | 'success';
  description: string | null;
  environment_url: string | null;
  log_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueDraft {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export interface RepoDraft {
  name: string;
  description: string;
  private: boolean;
  auto_init: boolean;
  template_repository?: string; // Format: "owner/repo"
}

export interface GitHubTemplate {
  name: string;
  owner: {
    login: string;
  };
  description: string;
  stargazersCount: number;
}

export interface WorkflowFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string;
  type: 'file';
  repoName: string;
  repoOwner: string;
  repoFullName: string;
}

export interface RepoPublicKey {
  key_id: string;
  key: string;
}

export interface RepoSecret {
  name: string;
  created_at: string;
  updated_at: string;
}

export enum AppRoute {
  TOKEN_INPUT = 'TOKEN_INPUT',
  REPO_LIST = 'REPO_LIST',
  REPO_DETAIL = 'REPO_DETAIL',
  ISSUE_DETAIL = 'ISSUE_DETAIL',
}