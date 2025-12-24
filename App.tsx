import React, { useState, useEffect } from 'react';
import { GitHubUser, Repository, Issue, AppRoute, Account } from './types';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase, handleRedirectResult } from './services/firebaseService';
import { validateToken } from './services/githubService';
import { ThemeProvider } from './contexts/ThemeContext';
import {
  getAllAccounts,
  addAccount,
  removeAccount,
  getActiveAccount,
  setActiveAccount,
  migrateLegacyAccount,
  clearAllAccounts,
} from './services/accountService';
import { clearCache } from './services/cacheService';

const App: React.FC = () => {
  // Migrate legacy single account on first load
  useEffect(() => {
    migrateLegacyAccount();
  }, []);

  const [accounts, setAccounts] = useState<Account[]>(() => getAllAccounts());
  const [activeAccount, setActiveAccountState] = useState<Account | null>(() => getActiveAccount());
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(
    activeAccount ? AppRoute.REPO_LIST : AppRoute.TOKEN_INPUT
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
    const account = addAccount(newToken, newUser);
    setActiveAccount(account.id);
    setAccounts(getAllAccounts());
    setActiveAccountState(account);
    setCurrentRoute(AppRoute.REPO_LIST);
  };

  const handleSwitchAccount = (accountId: string) => {
    setActiveAccount(accountId);
    const account = getActiveAccount();
    setActiveAccountState(account);
    setCurrentRoute(AppRoute.REPO_LIST);
    // Reset navigation state when switching accounts
    setSelectedRepo(null);
    setSelectedIssue(null);
  };

  const handleRemoveAccount = (accountId: string) => {
    // Clear all cached data for this account
    clearCache(undefined, accountId);
    
    removeAccount(accountId);
    const updatedAccounts = getAllAccounts();
    setAccounts(updatedAccounts);
    
    // If we removed the active account, switch to another or logout
    if (activeAccount?.id === accountId) {
      if (updatedAccounts.length > 0) {
        handleSwitchAccount(updatedAccounts[0].id);
      } else {
        handleLogout();
      }
    }
  };

  const handleLogout = async () => {
    // Sign out from Firebase
    try {
      await signOutFromFirebase();
    } catch (err) {
      console.error('Firebase sign out error:', err);
    }
    
    // Clear all accounts and cached data
    clearAllAccounts();
    clearCache();
    
    setAccounts([]);
    setActiveAccountState(null);
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

  if (currentRoute === AppRoute.TOKEN_INPUT || !activeAccount) {
    return <TokenGate onSuccess={handleLogin} />;
  }

  if (currentRoute === AppRoute.ISSUE_DETAIL && selectedRepo && selectedIssue) {
    return (
      <IssueDetail
        token={activeAccount.token}
        repo={selectedRepo}
        issue={selectedIssue}
        onBack={navigateBackToRepo}
      />
    );
  }

  if (currentRoute === AppRoute.REPO_DETAIL && selectedRepo) {
    return (
      <RepoDetail
        token={activeAccount.token}
        repo={selectedRepo}
        onBack={navigateBack}
        onIssueSelect={navigateToIssue}
      />
    );
  }

  return (
    <Dashboard
      token={activeAccount.token}
      user={activeAccount.user}
      accounts={accounts}
      activeAccount={activeAccount}
      onRepoSelect={navigateToRepo}
      onLogout={handleLogout}
      onSwitchAccount={handleSwitchAccount}
      onAddAccount={() => setCurrentRoute(AppRoute.TOKEN_INPUT)}
      onRemoveAccount={handleRemoveAccount}
    />
  );
};

const AppWithProviders: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWithProviders;
