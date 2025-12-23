import React, { useState, useEffect } from 'react';
import { GitHubUser, Repository, Issue, AppRoute } from './types';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase, handleRedirectResult } from './services/firebaseService';
import { validateToken } from './services/githubService';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('gh_token'));
  const [user, setUser] = useState<GitHubUser | null>(
    localStorage.getItem('gh_user') ? JSON.parse(localStorage.getItem('gh_user')!) : null
  );
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(
    token && user ? AppRoute.REPO_LIST : AppRoute.TOKEN_INPUT
  );
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Handle redirect result from Firebase OAuth (for popup-blocked fallback)
  useEffect(() => {
    const checkRedirectResult = async () => {
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
        setCheckingRedirect(false);
      }
    };
    
    checkRedirectResult();
  }, []);

  const handleLogin = (newToken: string, newUser: GitHubUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('gh_token', newToken);
    localStorage.setItem('gh_user', JSON.stringify(newUser));
    setCurrentRoute(AppRoute.REPO_LIST);
  };

  const handleLogout = async () => {
    // Sign out from Firebase
    try {
      await signOutFromFirebase();
    } catch (err) {
      console.error('Firebase sign out error:', err);
    }
    
    setToken(null);
    setUser(null);
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_user');
    setCurrentRoute(AppRoute.TOKEN_INPUT);
    setSelectedRepo(null);
  };

  const navigateToRepo = (repo: Repository) => {
    setSelectedRepo(repo);
    setCurrentRoute(AppRoute.REPO_DETAIL);
  };

  const navigateBack = () => {
    setSelectedRepo(null);
    setSelectedIssue(null);
    setCurrentRoute(AppRoute.REPO_LIST);
  };

  const navigateToIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setCurrentRoute(AppRoute.ISSUE_DETAIL);
  };

  const navigateBackToRepo = () => {
    setSelectedIssue(null);
    setCurrentRoute(AppRoute.REPO_DETAIL);
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
        user={user}
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

const AppWithProviders: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWithProviders;
