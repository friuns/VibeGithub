import { createMutable } from 'solid-js/store';
import { GitHubUser, Repository, Issue, AppRoute } from './types';
import { getCached, setCache, CacheKeys as CacheKeyFns, CachedExpandedIssueData } from './services/cacheService';

type Theme = 'light' | 'dark' | 'system';

interface AppStore {
  // Auth
  token: string | null;
  user: GitHubUser | null;
  checkingRedirect: boolean;
  
  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  
  // Navigation
  currentRoute: AppRoute;
  selectedRepo: Repository | null;
  selectedIssue: Issue | null;
}

// Import Comment type from types.ts if it exists, otherwise define locally
type Comment = any; // TODO: Define proper Comment type in types.ts
type WorkflowFile = any; // TODO: Define proper WorkflowFile type in types.ts

/**
 * Proxy-based auto-caching store
 * Automatically saves and loads data from localStorage using Proxy
 */
interface CacheStore {
  repos: Repository[];
  repoIssues: (owner: string, repo: string) => Issue[];
  issueComments: (owner: string, repo: string, issueNumber: number) => Comment[];
  workflowRuns: (owner: string, repo: string) => any[];
  prDetails: (owner: string, repo: string, prNumber: number) => any;
  issueExpandedData: (owner: string, repo: string, issueNumber: number) => CachedExpandedIssueData | null;
  workflowFiles: WorkflowFile[];
}

// Create a Proxy-based cache that automatically saves/loads
function createCachedProxy<T extends object>(initial: T, cacheKeyMap: Record<string, string>): T {
  return new Proxy(initial, {
    get(target: any, prop: string) {
      // If it's a function property, return a function that manages cache
      if (typeof target[prop] === 'function') {
        return target[prop];
      }
      
      // Check if we have a cache key for this property
      const cacheKey = cacheKeyMap[prop];
      if (cacheKey) {
        // Try to load from cache first
        const cached = getCached<any>(cacheKey);
        if (cached !== null) {
          target[prop] = cached;
        }
      }
      
      return target[prop];
    },
    
    set(target: any, prop: string, value: any) {
      target[prop] = value;
      
      // Automatically save to cache if we have a cache key
      const cacheKey = cacheKeyMap[prop];
      if (cacheKey && value !== null && value !== undefined) {
        setCache(cacheKey, value);
      }
      
      return true;
    }
  });
}

// Create cache store with Proxy auto-caching
const cacheKeyMapping = {
  repos: CacheKeyFns.repos(),
  workflowFiles: CacheKeyFns.workflowFiles(),
};

const initialCacheState = {
  repos: getCached<Repository[]>(CacheKeyFns.repos()) || [],
  workflowFiles: getCached<WorkflowFile[]>(CacheKeyFns.workflowFiles()) || [],
  
  // Factory functions for parameterized cache keys
  repoIssues: (owner: string, repo: string): Issue[] => {
    const key = CacheKeyFns.repoIssues(owner, repo);
    return getCached<Issue[]>(key) || [];
  },
  
  issueComments: (owner: string, repo: string, issueNumber: number): Comment[] => {
    const key = CacheKeyFns.issueComments(owner, repo, issueNumber);
    return getCached<Comment[]>(key) || [];
  },
  
  workflowRuns: (owner: string, repo: string): any[] => {
    const key = CacheKeyFns.workflowRuns(owner, repo);
    return getCached<any[]>(key) || [];
  },
  
  prDetails: (owner: string, repo: string, prNumber: number): any => {
    const key = CacheKeyFns.prDetails(owner, repo, prNumber);
    return getCached<any>(key) || null;
  },
  
  issueExpandedData: (owner: string, repo: string, issueNumber: number): CachedExpandedIssueData | null => {
    const key = CacheKeyFns.issueExpandedData(owner, repo, issueNumber);
    return getCached<CachedExpandedIssueData>(key);
  },
};

export const cache = createCachedProxy(initialCacheState, cacheKeyMapping);

// Helper function to set cache for parameterized keys
export const setRepoIssuesCache = (owner: string, repo: string, data: Issue[]) => {
  setCache(CacheKeyFns.repoIssues(owner, repo), data);
};

export const setIssueExpandedDataCache = (owner: string, repo: string, issueNumber: number, data: CachedExpandedIssueData) => {
  setCache(CacheKeyFns.issueExpandedData(owner, repo, issueNumber), data);
};

export const setWorkflowFilesCache = (data: WorkflowFile[]) => {
  setCache(CacheKeyFns.workflowFiles(), data);
};

// Initialize theme from localStorage
const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
};

const getInitialResolvedTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};

const initialTheme = getInitialTheme();

export const store = createMutable<AppStore>({
  token: localStorage.getItem('gh_token'),
  user: localStorage.getItem('gh_user') ? JSON.parse(localStorage.getItem('gh_user')!) : null,
  checkingRedirect: true,
  theme: initialTheme,
  resolvedTheme: getInitialResolvedTheme(initialTheme),
  currentRoute: (localStorage.getItem('gh_token') && localStorage.getItem('gh_user')) 
    ? AppRoute.REPO_LIST 
    : AppRoute.TOKEN_INPUT,
  selectedRepo: null,
  selectedIssue: null,
});

// Theme management functions
export const setTheme = (newTheme: Theme) => {
  store.theme = newTheme;
  if (newTheme === 'system') {
    localStorage.removeItem('theme');
    store.resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    localStorage.setItem('theme', newTheme);
    store.resolvedTheme = newTheme;
  }
};

export const updateResolvedTheme = () => {
  if (store.theme === 'system') {
    store.resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    store.resolvedTheme = store.theme;
  }
};

// Auth functions
export const handleLogin = (newToken: string, newUser: GitHubUser) => {
  store.token = newToken;
  store.user = newUser;
  localStorage.setItem('gh_token', newToken);
  localStorage.setItem('gh_user', JSON.stringify(newUser));
  store.currentRoute = AppRoute.REPO_LIST;
};

export const handleLogout = async (signOutFromFirebase: () => Promise<void>) => {
  try {
    await signOutFromFirebase();
  } catch (err) {
    console.error('Firebase sign out error:', err);
  }
  
  store.token = null;
  store.user = null;
  localStorage.removeItem('gh_token');
  localStorage.removeItem('gh_user');
  store.currentRoute = AppRoute.TOKEN_INPUT;
  store.selectedRepo = null;
};

// Navigation functions
export const navigateToRepo = (repo: Repository) => {
  store.selectedRepo = repo;
  store.currentRoute = AppRoute.REPO_DETAIL;
};

export const navigateBack = () => {
  store.selectedRepo = null;
  store.selectedIssue = null;
  store.currentRoute = AppRoute.REPO_LIST;
};

export const navigateToIssue = (issue: Issue) => {
  store.selectedIssue = issue;
  store.currentRoute = AppRoute.ISSUE_DETAIL;
};

export const navigateBackToRepo = () => {
  store.selectedIssue = null;
  store.currentRoute = AppRoute.REPO_DETAIL;
};
