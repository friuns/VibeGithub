import React, { useState } from 'react';
import { GitHubUser, Repository, Issue, AppRoute } from './types';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase } from './services/firebaseService';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('gh_token'));
  const [user, setUser] = useState<GitHubUser | null>(
    localStorage.getItem('gh_user') ? JSON.parse(localStorage.getItem('gh_user')!) : null
  );

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(
    token && user ? AppRoute.REPO_LIST : AppRoute.TOKEN_INPUT
  );
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

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

const AppWithProviders: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWithProviders;
