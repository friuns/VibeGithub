import { onMount, onCleanup, Show, createEffect } from 'solid-js';
import { AppRoute } from './types';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase, handleRedirectResult } from './services/firebaseService';
import { validateToken } from './services/githubService';
import { 
  store, 
  handleLogin, 
  handleLogout, 
  navigateToRepo, 
  navigateBack, 
  navigateToIssue, 
  navigateBackToRepo,
  updateResolvedTheme
} from './store';

const App = () => {
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
      store.checkingRedirect = false;
    }
  });

  // Theme effect
  createEffect(() => {
    updateResolvedTheme();
  });

  // Listen for OS preference changes
  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (store.theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handler);
    onCleanup(() => mediaQuery.removeEventListener('change', handler));
  });

  // Update DOM class based on theme
  createEffect(() => {
    if (store.resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const onLogout = () => handleLogout(signOutFromFirebase);

  // Render Logic
  return (
    <Show
      when={!store.checkingRedirect}
      fallback={
        <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
        </div>
      }
    >
      <Show
        when={store.currentRoute !== AppRoute.TOKEN_INPUT && store.token && store.user}
        fallback={<TokenGate onSuccess={handleLogin} />}
      >
        <Show when={store.currentRoute === AppRoute.ISSUE_DETAIL && store.selectedRepo && store.selectedIssue}>
          <IssueDetail
            token={store.token!}
            repo={store.selectedRepo!}
            issue={store.selectedIssue!}
            onBack={navigateBackToRepo}
          />
        </Show>

        <Show when={store.currentRoute === AppRoute.REPO_DETAIL && store.selectedRepo}>
          <RepoDetail
            token={store.token!}
            repo={store.selectedRepo!}
            onBack={navigateBack}
            onIssueSelect={navigateToIssue}
          />
        </Show>

        <Show when={store.currentRoute === AppRoute.REPO_LIST}>
          <Dashboard
            token={store.token!}
            user={store.user!}
            onRepoSelect={navigateToRepo}
            onLogout={onLogout}
          />
        </Show>
      </Show>
    </Show>
  );
};

export default App;
