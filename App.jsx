import { onMount } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { AppRoute } from './types.js';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase, handleRedirectResult } from './services/firebaseService';
import { validateToken } from './services/githubService';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  const state = createMutable({
    token: localStorage.getItem('gh_token'),
    user: localStorage.getItem('gh_user') ? JSON.parse(localStorage.getItem('gh_user')) : null,
    checkingRedirect: true,
    currentRoute: localStorage.getItem('gh_token') && localStorage.getItem('gh_user') ? AppRoute.REPO_LIST : AppRoute.TOKEN_INPUT,
    selectedRepo: null,
    selectedIssue: null,
  });

  onMount(async () => {
    try {
      const result = await handleRedirectResult();
      if (result) {
        const ghUser = await validateToken(result.accessToken);
        handleLogin(result.accessToken, ghUser);
      }
    } catch (err) {
      console.error('Redirect result error:', err);
    } finally {
      state.checkingRedirect = false;
    }
  });

  const handleLogin = (newToken, newUser) => {
    state.token = newToken;
    state.user = newUser;
    localStorage.setItem('gh_token', newToken);
    localStorage.setItem('gh_user', JSON.stringify(newUser));
    state.currentRoute = AppRoute.REPO_LIST;
  };

  const handleLogout = async () => {
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

  const navigateToRepo = (repo) => {
    state.selectedRepo = repo;
    state.currentRoute = AppRoute.REPO_DETAIL;
  };

  const navigateBack = () => {
    state.selectedRepo = null;
    state.selectedIssue = null;
    state.currentRoute = AppRoute.REPO_LIST;
  };

  const navigateToIssue = (issue) => {
    state.selectedIssue = issue;
    state.currentRoute = AppRoute.ISSUE_DETAIL;
  };

  const navigateBackToRepo = () => {
    state.selectedIssue = null;
    state.currentRoute = AppRoute.REPO_DETAIL;
  };

  return (
    <Show when={!state.checkingRedirect} fallback={
      <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
      </div>
    }>
      <Switch>
        <Match when={state.currentRoute === AppRoute.TOKEN_INPUT || !state.token || !state.user}>
          <TokenGate onSuccess={handleLogin} />
        </Match>
        <Match when={state.currentRoute === AppRoute.ISSUE_DETAIL && state.selectedRepo && state.selectedIssue}>
          <IssueDetail
            token={state.token}
            repo={state.selectedRepo}
            issue={state.selectedIssue}
            onBack={navigateBackToRepo}
          />
        </Match>
        <Match when={state.currentRoute === AppRoute.REPO_DETAIL && state.selectedRepo}>
          <RepoDetail
            token={state.token}
            repo={state.selectedRepo}
            onBack={navigateBack}
            onIssueSelect={navigateToIssue}
          />
        </Match>
        <Match when={state.currentRoute === AppRoute.REPO_LIST}>
          <Dashboard
            token={state.token}
            user={state.user}
            onRepoSelect={navigateToRepo}
            onLogout={handleLogout}
          />
        </Match>
      </Switch>
    </Show>
  );
};

const AppWithProviders = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWithProviders;
