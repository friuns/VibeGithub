import { createMutable } from 'solid-js/store';
import { GitHubUser, Repository, Issue, AppRoute } from './types';

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
