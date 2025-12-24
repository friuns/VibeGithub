import { createSignal } from 'solid-js';
import { validateToken } from '../services/githubService';
import { signInWithGitHub } from '../services/firebaseService';
import { Button } from '../components/Button';
import { Github } from 'lucide-solid';

export const TokenGate = (props) => {
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleGitHubLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const { accessToken } = await signInWithGitHub();
      const user = await validateToken(accessToken);
      props.onSuccess(accessToken, user);
    } catch (err) {
      console.error('GitHub login error:', err);
      const message = err.message || 'Failed to sign in with GitHub';
      if (message.includes('popup-closed-by-user')) {
        setError('Sign in was cancelled. Please try again.');
      } else if (message.includes('account-exists-with-different-credential')) {
        setError('An account already exists with the same email. Try signing in with a different method.');
      } else if (message.includes('Redirecting')) {
        setError('');
        return;
      } else if (message.includes('popup-blocked') || message.includes('popup_blocked')) {
        setError('Popup was blocked. Redirecting to GitHub...');
        return;
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div class="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-slate-900/50 p-8 border border-slate-200 dark:border-slate-700">
        <div class="flex flex-col items-center mb-6">
          <div class="bg-slate-900 dark:bg-slate-700 p-3 rounded-full mb-4 text-white">
            <Github size={32} />
          </div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome to GitGenius</h1>
          <p class="text-slate-500 dark:text-slate-400 text-center mt-2">
            Sign in with your GitHub account to manage your repositories with AI assistance.
          </p>
        </div>

        <div class="space-y-4">
          <Show when={error()}>
            <div class="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-md border border-red-200 dark:border-red-800">
              {error()}
            </div>
          </Show>

          <Button
            onClick={handleGitHubLogin}
            class="w-full"
            isLoading={loading()}
            variant="primary"
          >
            <Github class="mr-2" size={20} />
            Sign in with GitHub
          </Button>

          <p class="text-xs text-slate-400 dark:text-slate-500 text-center">
            By signing in, you grant access to your public and private repositories.
          </p>
        </div>
      </div>
    </div>
  );
};
