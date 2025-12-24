import { createEffect, onMount } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { GitHubUser, Repository, Issue, AppRoute } from './types';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase, handleRedirectResult } from './services/firebaseService';
import { validateToken } from './services/githubService';
import { ThemeProvider } from './contexts/ThemeContext';

const App = () => {
  const state = createMutable({
    token: localStorage.getItem('gh_token'),
    user: localStorage.getItem('gh_user') ? JSON.parse(localStorage.getItem('gh_user')!) : null,
    checkingRedirect: true,
    currentRoute: AppRoute.TOKEN_INPUT as AppRoute,
    selectedRepo: null as Repository | null,
    selectedIssue: null as Issue | null,
  });

  // Set initial route based on token and user
  createEffect(() => {
    if (state.token && state.user) {
      state.currentRoute = AppRoute.REPO_LIST;
    } else {
      state.currentRoute = AppRoute.TOKEN_INPUT;
    }
  });

  // Handle redirect result from Firebase OAuth (for popup-blocked fallback)
  onMount(async () => {
    try {
      const result = await handleRedirectResult();
      if (result) {
        // Validate token and get user data from GitHub API
        const ghUser = await validateToken(result.accessToken);
        handleLogin(result.accessToken, ghUser);
      }
    } catch (err) {
      console.error('Redirect result error:', err);
    } finally {
      state.checkingRedirect = false;
    }
  });

  const handleLogin = (newToken: string, newUser: GitHubUser) => {
    state.token = newToken;
    state.user = newUser;
    localStorage.setItem('gh_token', newToken);
    localStorage.setItem('gh_user', JSON.stringify(newUser));
    state.currentRoute = AppRoute.REPO_LIST;
  };

  const handleLogout = async () => {
    // Sign out from Firebase
    try {
      await signOutFromFirebase();
    } catch (err) {
      console.error('Firebase sign out error:', err);
    }

    state.token = null;
    state.user = null;
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_user');
    state.currentRoute = AppRoute.TOKEN_INPUT;
    state.selectedRepo = null;
  };

  const navigateToRepo = (repo: Repository) => {
    state.selectedRepo = repo;
    state.currentRoute = AppRoute.REPO_DETAIL;
  };

  const navigateBack = () => {
    state.selectedRepo = null;
    state.selectedIssue = null;
    state.currentRoute = AppRoute.REPO_LIST;
  };

  const navigateToIssue = (issue: Issue) => {
    state.selectedIssue = issue;
    state.currentRoute = AppRoute.ISSUE_DETAIL;
  };

  const navigateBackToRepo = () => {
    state.selectedIssue = null;
    state.currentRoute = AppRoute.REPO_DETAIL;
  };

  // Render Logic
  if (checkingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
      </div>
    );
  }

  if (currentRoute === AppRoute.TOKEN_INPUT || !token || !user) {
    return <TokenGate onSuccess={handleLogin} />;
  }

  if (currentRoute === AppRoute.ISSUE_DETAIL && selectedRepo && selectedIssue) {
    return (
      <IssueDetail
        token={token}
        repo={selectedRepo}
        issue={selectedIssue}
        onBack={navigateBackToRepo}
      />
    );
  }

  if (currentRoute === AppRoute.REPO_DETAIL && selectedRepo) {
    return (
      <RepoDetail
        token={token}
        repo={selectedRepo}
        onBack={navigateBack}
        onIssueSelect={navigateToIssue}
      />
    );
  }

  return (
    <Dashboard
      token={token}
      user={user}
      onRepoSelect={navigateToRepo}
      onLogout={handleLogout}
    />
  );
};

const AppWithProviders = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWithProviders;
