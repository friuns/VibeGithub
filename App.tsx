import React, { useState, useEffect } from 'react';
import { GitHubUser, Repository, Issue, AppRoute, Account } from './types';
import { TokenGate } from './views/TokenGate';
import { Dashboard } from './views/Dashboard';
import { RepoDetail } from './views/RepoDetail';
import { IssueDetail } from './views/IssueDetail';
import { signOutFromFirebase, handleRedirectResult } from './services/firebaseService';
import { validateToken } from './services/githubService';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const stored = localStorage.getItem('gh_accounts');
    return stored ? JSON.parse(stored) : [];
  });
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(() => {
    return localStorage.getItem('gh_current_account');
  });
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(
    currentAccountId && accounts.length > 0 ? AppRoute.REPO_LIST : AppRoute.TOKEN_INPUT
  );
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Helper to get current account
  const currentAccount = accounts.find(acc => acc.id === currentAccountId) || null;
  const currentToken = currentAccount?.token || null;
  const currentUser = currentAccount?.user || null;

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
    const accountId = newUser.login;
    const newAccount: Account = {
      id: accountId,
      token: newToken,
      user: newUser,
    };

    const updatedAccounts = accounts.filter(acc => acc.id !== accountId).concat(newAccount);

    setAccounts(updatedAccounts);
    setCurrentAccountId(accountId);
    localStorage.setItem('gh_accounts', JSON.stringify(updatedAccounts));
    localStorage.setItem('gh_current_account', accountId);
    setCurrentRoute(AppRoute.REPO_LIST);
  };

  const handleLogout = async (accountId?: string) => {
    const accountToLogout = accountId || currentAccountId;
    if (!accountToLogout) return;

    // Sign out from Firebase (this signs out the current Firebase user)
    try {
      await signOutFromFirebase();
    } catch (err) {
      console.error('Firebase sign out error:', err);
    }

    // Remove the account from accounts
    const updatedAccounts = accounts.filter(acc => acc.id !== accountToLogout);
    setAccounts(updatedAccounts);
    localStorage.setItem('gh_accounts', JSON.stringify(updatedAccounts));

    // If this was the current account, switch to another or go to login
    if (accountToLogout === currentAccountId) {
      if (updatedAccounts.length > 0) {
        const nextAccount = updatedAccounts[0];
        setCurrentAccountId(nextAccount.id);
        localStorage.setItem('gh_current_account', nextAccount.id);
      } else {
        setCurrentAccountId(null);
        localStorage.removeItem('gh_current_account');
        setCurrentRoute(AppRoute.TOKEN_INPUT);
      }
    }

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

  const switchAccount = (accountId: string) => {
    setCurrentAccountId(accountId);
    localStorage.setItem('gh_current_account', accountId);
    // Navigate back to dashboard when switching accounts
    setSelectedRepo(null);
    setSelectedIssue(null);
    setCurrentRoute(AppRoute.REPO_LIST);
  };

  // Render Logic
  if (checkingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
      </div>
    );
  }

  if (currentRoute === AppRoute.TOKEN_INPUT || !currentToken || !currentUser) {
    return <TokenGate onSuccess={handleLogin} />;
  }

  if (currentRoute === AppRoute.ISSUE_DETAIL && selectedRepo && selectedIssue) {
    return (
      <IssueDetail
        token={currentToken}
        repo={selectedRepo}
        issue={selectedIssue}
        onBack={navigateBackToRepo}
        accountId={currentAccountId || ''}
      />
    );
  }

  if (currentRoute === AppRoute.REPO_DETAIL && selectedRepo) {
    return (
      <RepoDetail
        token={currentToken}
        repo={selectedRepo}
        onBack={navigateBack}
        onIssueSelect={navigateToIssue}
        accountId={currentAccountId || ''}
      />
    );
  }

  return (
    <Dashboard
      token={currentToken}
      user={currentUser}
      accounts={accounts}
      currentAccountId={currentAccountId}
      onRepoSelect={navigateToRepo}
      onLogout={handleLogout}
      onSwitchAccount={switchAccount}
      onAddAccount={() => setCurrentRoute(AppRoute.TOKEN_INPUT)}
      accountId={currentAccountId || ''}
    />
  );
};

const AppWithProviders: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWithProviders;
