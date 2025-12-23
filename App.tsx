import React, { useState, useEffect } from 'react';
import { GitHubUser, Repository, Issue, AppRoute } from './types';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase, handleRedirectResult } from './services/firebaseService';
import { validateToken } from './services/githubService';
import { ThemeProvider } from './contexts/ThemeContext';
import { 
  getActiveAccount, 
  getAccounts, 
  addAccount, 
  removeAccount, 
  setActiveAccount,
  migrateOldAccountData,
  Account,
  clearAllAccounts
} from './services/accountService';

const App: React.FC = () => {
  // Migrate old single-account data on first load
  React.useEffect(() => {
    migrateOldAccountData();
  }, []);

  const [currentAccount, setCurrentAccount] = useState<Account | null>(() => getActiveAccount());
  const [accounts, setAccounts] = useState<Account[]>(() => getAccounts());
  const [checkingRedirect, setCheckingRedirect] = useState(true);
  const [addingAccount, setAddingAccount] = useState(false);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(
    currentAccount ? AppRoute.REPO_LIST : AppRoute.TOKEN_INPUT
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
    setCurrentAccount(account);
    setAccounts(getAccounts());
    setCurrentRoute(AppRoute.REPO_LIST);
    setAddingAccount(false);
  };

  const handleLogout = async () => {
    // Sign out from Firebase
    try {
      await signOutFromFirebase();
    } catch (err) {
      console.error('Firebase sign out error:', err);
    }
    
    // Clear all accounts
    clearAllAccounts();
    setCurrentAccount(null);
    setAccounts([]);
    setCurrentRoute(AppRoute.TOKEN_INPUT);
    setSelectedRepo(null);
    setAddingAccount(false);
  };

  const handleSwitchAccount = (accountId: string) => {
    if (setActiveAccount(accountId)) {
      const account = getActiveAccount();
      setCurrentAccount(account);
      // Reset navigation to repo list when switching accounts
      setCurrentRoute(AppRoute.REPO_LIST);
      setSelectedRepo(null);
      setSelectedIssue(null);
    }
  };

  const handleRemoveAccount = (accountId: string) => {
    removeAccount(accountId);
    const updatedAccounts = getAccounts();
    setAccounts(updatedAccounts);
    
    // If we removed the current account, update to the new active one
    if (currentAccount?.id === accountId) {
      const newActiveAccount = getActiveAccount();
      setCurrentAccount(newActiveAccount);
      
      // If no accounts left, go to login
      if (!newActiveAccount) {
        setCurrentRoute(AppRoute.TOKEN_INPUT);
        setSelectedRepo(null);
        setSelectedIssue(null);
      } else {
        // Reset to repo list
        setCurrentRoute(AppRoute.REPO_LIST);
        setSelectedRepo(null);
        setSelectedIssue(null);
      }
    }
  };

  const handleAddAccount = () => {
    setAddingAccount(true);
    setCurrentRoute(AppRoute.TOKEN_INPUT);
  };

  const handleCancelAddAccount = () => {
    setAddingAccount(false);
    setCurrentRoute(AppRoute.REPO_LIST);
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

  if (currentRoute === AppRoute.TOKEN_INPUT || !currentAccount) {
    return <TokenGate 
      onSuccess={handleLogin} 
      isAddingAccount={addingAccount} 
      onCancel={addingAccount ? handleCancelAddAccount : undefined} 
    />;
  }

  if (currentRoute === AppRoute.ISSUE_DETAIL && selectedRepo && selectedIssue) {
    return (
      <IssueDetail
        token={currentAccount.token}
        repo={selectedRepo}
        issue={selectedIssue}
        onBack={navigateBackToRepo}
        accountId={currentAccount.id}
      />
    );
  }

  if (currentRoute === AppRoute.REPO_DETAIL && selectedRepo) {
    return (
      <RepoDetail
        token={currentAccount.token}
        repo={selectedRepo}
        onBack={navigateBack}
        onIssueSelect={navigateToIssue}
        accountId={currentAccount.id}
      />
    );
  }

  return (
    <Dashboard
      token={currentAccount.token}
      user={currentAccount.user}
      onRepoSelect={navigateToRepo}
      onLogout={handleLogout}
      accounts={accounts}
      currentAccount={currentAccount}
      onSwitchAccount={handleSwitchAccount}
      onAddAccount={handleAddAccount}
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
