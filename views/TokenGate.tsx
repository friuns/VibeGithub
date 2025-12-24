import React, { useState } from 'react';
import { validateToken } from '../services/githubService';
import { signInWithGitHub } from '../services/firebaseService';
import { GitHubUser } from '../types';
import { Button } from '../components/Button';
import { Github, Key } from 'lucide-react';

interface TokenGateProps {
  onSuccess: (token: string, user: GitHubUser) => void;
}

export const TokenGate: React.FC<TokenGateProps> = ({ onSuccess }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPatInput, setShowPatInput] = useState(false);
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
    setError('');
    
    if (!patToken.trim()) {
      setError('Please enter a Personal Access Token');
      return;
    }
    
    setLoading(true);
    
    try {
      // Validate token and get user data from GitHub API
      const user = await validateToken(patToken.trim());
      onSuccess(patToken.trim(), user);
    } catch (err: unknown) {
      console.error('PAT login error:', err);
      const message = err instanceof Error ? err.message : 'Failed to authenticate with PAT';
      setError(message);
    } finally {
      setLoading(false);
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
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-md border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {!showPatInput ? (
            <>
              <Button 
                onClick={handleGitHubLogin} 
                className="w-full" 
                isLoading={loading} 
                variant="primary"
              >
                <Github className="mr-2" size={20} />
                Sign in with GitHub
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    Or
                  </span>
                </div>
              </div>

              <Button 
                onClick={() => setShowPatInput(true)} 
                className="w-full" 
                variant="secondary"
              >
                <Key className="mr-2" size={20} />
                Sign in with Personal Access Token
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="pat-token" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Personal Access Token
                </label>
                <input
                  id="pat-token"
                  type="password"
                  value={patToken}
                  onChange={(e) => setPatToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePatLogin()}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <a 
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Create a token
                  </a>
                  {' '}with <code className="bg-slate-100 dark:bg-slate-600 px-1 rounded">repo</code> and <code className="bg-slate-100 dark:bg-slate-600 px-1 rounded">read:user</code> scopes.
                </p>
              </div>

              <Button 
                onClick={handlePatLogin} 
                className="w-full" 
                isLoading={loading} 
                variant="primary"
              >
                Sign in
              </Button>

              <Button 
                onClick={() => {
                  setShowPatInput(false);
                  setPatToken('');
                  setError('');
                }} 
                className="w-full" 
                variant="secondary"
                disabled={loading}
              >
                Back to OAuth
              </Button>
            </>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            By signing in, you grant access to your public and private repositories.
          </p>
        </div>
      </div>
    </div>
  );
};
