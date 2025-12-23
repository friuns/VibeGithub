// Cache service for stale-while-revalidate pattern
// Shows cached data instantly, then updates with fresh data in background

const CACHE_PREFIX = 'vibe_github_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes - data considered "fresh" within this time

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export function isCacheFresh(key: string, ttl = DEFAULT_TTL): boolean {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return false;
    const entry = JSON.parse(raw);
    return Date.now() - entry.timestamp < ttl;
  } catch {
    return false;
  }
}

export function clearCache(key?: string): void {
  if (key) {
    localStorage.removeItem(CACHE_PREFIX + key);
  } else {
    // Clear all cache entries
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}

// Cache keys helper
export const CacheKeys = {
  repos: (accountId?: string) => accountId ? `repos_${accountId}` : 'repos',
  repoIssues: (owner: string, repo: string, accountId?: string) => accountId ? `issues_${accountId}_${owner}_${repo}` : `issues_${owner}_${repo}`,
  issueComments: (owner: string, repo: string, issueNumber: number, accountId?: string) => accountId ? `comments_${accountId}_${owner}_${repo}_${issueNumber}` : `comments_${owner}_${repo}_${issueNumber}`,
  workflowRuns: (owner: string, repo: string, accountId?: string) => accountId ? `workflows_${accountId}_${owner}_${repo}` : `workflows_${owner}_${repo}`,
  prDetails: (owner: string, repo: string, prNumber: number, accountId?: string) => accountId ? `pr_${accountId}_${owner}_${repo}_${prNumber}` : `pr_${owner}_${repo}_${prNumber}`,
  issueExpandedData: (owner: string, repo: string, issueNumber: number, accountId?: string) => accountId ? `expanded_${accountId}_${owner}_${repo}_${issueNumber}` : `expanded_${owner}_${repo}_${issueNumber}`,
  workflowFiles: (accountId?: string) => accountId ? `workflow_files_${accountId}` : 'workflow_files',
};

// Type for cached expanded issue data (all data needed for expanded view)
export interface CachedExpandedIssueData {
  comments: any[];
  workflowRuns: any[];
  prDetails: Record<number, any>;
  deploymentsByPr: Record<number, any[]>;
  artifacts: Record<number, any[]>;
  prComments: Record<number, any[]>;
}

