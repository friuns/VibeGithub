import { createMutable } from 'solid-js/store';
import { validateToken } from '../services/githubService';
import { signInWithGitHub } from '../services/firebaseService';
import { GitHubUser } from '../types';
import { Button } from '../components/Button';
import { Github } from 'lucide-react';

interface TokenGateProps {
  onSuccess: (token: string, user: GitHubUser) => void;
}

export const TokenGate = (props: TokenGateProps) => {
  const state = createMutable({
    error: '',
    loading: false,
  });

  const handleGitHubLogin = async () => {
    state.error = '';
    state.loading = true;

    try {
      // Sign in with GitHub via Firebase
      const { accessToken } = await signInWithGitHub();

      // Validate token and get user data from GitHub API
      const user = await validateToken(accessToken);
      props.onSuccess(accessToken, user);
    } catch (err: unknown) {
      console.error('GitHub login error:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign in with GitHub';
      // Handle common Firebase auth errors
      if (message.includes('popup-closed-by-user')) {
        state.error = 'Sign in was cancelled. Please try again.';
      } else if (message.includes('account-exists-with-different-credential')) {
        state.error = 'An account already exists with the same email. Try signing in with a different method.';
      } else if (message.includes('Redirecting')) {
        // Popup was blocked, redirecting to GitHub - don't show error
        state.error = '';
        return;
      } else if (message.includes('popup-blocked') || message.includes('popup_blocked')) {
        state.error = 'Popup was blocked. Redirecting to GitHub...';
        return;
      } else {
        state.error = message;
      }
    } finally {
      state.loading = false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-slate-900/50 p-8 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-slate-900 dark:bg-slate-700 p-3 rounded-full mb-4 text-white">
            <Github size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome to GitGenius</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2">
            Sign in with your GitHub account to manage your repositories with AI assistance.
          </p>
        </div>

        <div className="space-y-4">
          {state.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-md border border-red-200 dark:border-red-800">
              {state.error}
            </div>
          )}

          <Button
            onClick={handleGitHubLogin}
            className="w-full"
            isLoading={state.loading}
            variant="primary"
          >
            <Github className="mr-2" size={20} />
            Sign in with GitHub
          </Button>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            By signing in, you grant access to your public and private repositories.
          </p>
        </div>
      </div>
    </div>
  );
};
