// Cache service for stale-while-revalidate pattern
// Shows cached data instantly, then updates with fresh data in background

const CACHE_PREFIX = 'vibe_github_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes - data considered "fresh" within this time

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Get account-specific cache key
function getAccountCacheKey(key: string, accountId?: string): string {
  if (accountId) {
    return `${CACHE_PREFIX}${accountId}_${key}`;
  }
  return CACHE_PREFIX + key;
}

export function getCached<T>(key: string, accountId?: string): T | null {
  try {
    const cacheKey = getAccountCacheKey(key, accountId);
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, accountId?: string): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    const cacheKey = getAccountCacheKey(key, accountId);
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export function isCacheFresh(key: string, ttl = DEFAULT_TTL, accountId?: string): boolean {
  try {
    const cacheKey = getAccountCacheKey(key, accountId);
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return false;
    const entry = JSON.parse(raw);
    return Date.now() - entry.timestamp < ttl;
  } catch {
    return false;
  }
}

export function clearCache(key?: string, accountId?: string): void {
  if (key) {
    const cacheKey = getAccountCacheKey(key, accountId);
    localStorage.removeItem(cacheKey);
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

