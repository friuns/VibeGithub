// Cache service for stale-while-revalidate pattern
// Shows cached data instantly, then updates with fresh data in background

const CACHE_PREFIX = 'vibe_github_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes - data considered "fresh" within this time

// Get the current account ID for cache scoping
function getCurrentAccountId(): string {
  const activeAccountId = localStorage.getItem('gh_active_account_id');
  return activeAccountId || 'default';
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const accountId = getCurrentAccountId();
    const scopedKey = `${accountId}_${key}`;
    const raw = localStorage.getItem(CACHE_PREFIX + scopedKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const accountId = getCurrentAccountId();
    const scopedKey = `${accountId}_${key}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + scopedKey, JSON.stringify(entry));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export function isCacheFresh(key: string, ttl = DEFAULT_TTL): boolean {
  try {
    const accountId = getCurrentAccountId();
    const scopedKey = `${accountId}_${key}`;
    const raw = localStorage.getItem(CACHE_PREFIX + scopedKey);
    if (!raw) return false;
    const entry = JSON.parse(raw);
    return Date.now() - entry.timestamp < ttl;
  } catch {
    return false;
  }
}

export function clearCache(key?: string, accountId?: string): void {
  if (key && accountId) {
    // Clear specific key for specific account
    const scopedKey = `${accountId}_${key}`;
    localStorage.removeItem(CACHE_PREFIX + scopedKey);
  } else if (key) {
    // Clear specific key for current account
    const accId = getCurrentAccountId();
    const scopedKey = `${accId}_${key}`;
    localStorage.removeItem(CACHE_PREFIX + scopedKey);
  } else if (accountId) {
    // Clear all keys for specific account
    const prefix = CACHE_PREFIX + accountId + '_';
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
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
  repos: () => 'repos',
  repoIssues: (owner: string, repo: string) => `issues_${owner}_${repo}`,
  issueComments: (owner: string, repo: string, issueNumber: number) => `comments_${owner}_${repo}_${issueNumber}`,
  workflowRuns: (owner: string, repo: string) => `workflows_${owner}_${repo}`,
  prDetails: (owner: string, repo: string, prNumber: number) => `pr_${owner}_${repo}_${prNumber}`,
  issueExpandedData: (owner: string, repo: string, issueNumber: number) => `expanded_${owner}_${repo}_${issueNumber}`,
  workflowFiles: () => 'workflow_files',
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

