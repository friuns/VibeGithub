import React, { useState } from 'react';
import { validateToken } from '../services/githubService';
import { signInWithGitHub } from '../services/firebaseService';
import { GitHubUser } from '../types';
import { Button } from '../components/Button';
import { Github, Key, ArrowLeft } from 'lucide-react';

type AuthMethod = 'select' | 'pat';

interface TokenGateProps {
  onSuccess: (token: string, user: GitHubUser) => void;
}

export const TokenGate: React.FC<TokenGateProps> = ({ onSuccess }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('select');
  const [patToken, setPatToken] = useState('');

  const handleGitHubLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      // Sign in with GitHub via Firebase
      const { accessToken } = await signInWithGitHub();
      
      // Validate token and get user data from GitHub API
      const user = await validateToken(accessToken);
      onSuccess(accessToken, user);
    } catch (err: unknown) {
      console.error('GitHub login error:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign in with GitHub';
      // Handle common Firebase auth errors
      if (message.includes('popup-closed-by-user')) {
        setError('Sign in was cancelled. Please try again.');
      } else if (message.includes('account-exists-with-different-credential')) {
        setError('An account already exists with the same email. Try signing in with a different method.');
      } else if (message.includes('Redirecting')) {
        // Popup was blocked, redirecting to GitHub - don't show error
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

  const handlePatLogin = async () => {
    if (!patToken.trim()) {
      setError('Please enter a Personal Access Token');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Validate the PAT and get user data
      const user = await validateToken(patToken.trim());
      onSuccess(patToken.trim(), user);
    } catch (err: unknown) {
      console.error('PAT login error:', err);
      const message = err instanceof Error ? err.message : 'Invalid Personal Access Token';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setAuthMethod('select');
    setError('');
    setPatToken('');
  };

  // Method selection view
  if (authMethod === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-slate-900/50 p-8 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-slate-900 dark:bg-slate-700 p-3 rounded-full mb-4 text-white">
              <Github size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome to GitGenius</h1>
            <p className="text-slate-500 dark:text-slate-400 text-center mt-2">
              Choose how you'd like to sign in to manage your repositories with AI assistance.
            </p>
          </div>

          <div className="space-y-3">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-md border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <Button 
              onClick={handleGitHubLogin} 
              className="w-full" 
              variant="primary"
              isLoading={loading}
            >
              <Github className="mr-2" size={20} />
              Sign in with GitHub
            </Button>

            <Button 
              onClick={() => setAuthMethod('pat')} 
              className="w-full" 
              variant="secondary"
            >
              <Key className="mr-2" size={20} />
              Use Personal Access Token
            </Button>

            <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2">
              By signing in, you grant access to your public and private repositories.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // PAT login view
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-slate-900/50 p-8 border border-slate-200 dark:border-slate-700">
        <button
          onClick={handleBack}
          className="flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="bg-slate-900 dark:bg-slate-700 p-3 rounded-full mb-4 text-white">
            <Key size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Personal Access Token</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2">
            Enter your GitHub PAT to sign in. You can create one in your{' '}
            <a 
              href="https://github.com/settings/tokens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              GitHub settings
            </a>.
          </p>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-md border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="pat-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Personal Access Token
            </label>
            <input
              id="pat-input"
              type="password"
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePatLogin()}
              placeholder="ghp_xxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
              disabled={loading}
            />
          </div>

          <Button 
            onClick={handlePatLogin} 
            className="w-full" 
            isLoading={loading} 
            variant="primary"
            disabled={!patToken.trim()}
          >
            <Key className="mr-2" size={20} />
            Sign in with PAT
          </Button>

          <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
            <p className="font-medium">Required scopes for full functionality:</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">repo</code> - Full repository access</li>
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">workflow</code> - GitHub Actions workflows</li>
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">delete_repo</code> - Delete repositories</li>
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">read:user</code> - Read user profile</li>
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">user:email</code> - Access email addresses</li>
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">gist</code> - Manage gists</li>
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">notifications</code> - Access notifications</li>
              <li><code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">project</code> - Manage projects</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
