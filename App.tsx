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
    const savedAccounts = localStorage.getItem('gh_accounts');
    return savedAccounts ? JSON.parse(savedAccounts) : [];
  });

  const [activeAccount, setActiveAccount] = useState<Account | null>(() => {
    const savedAccounts = localStorage.getItem('gh_accounts');
    if (!savedAccounts) return null;
    const accountsList: Account[] = JSON.parse(savedAccounts);
    const activeLogin = localStorage.getItem('gh_active_account_login');
    if (activeLogin) {
      return accountsList.find(acc => acc.user.login === activeLogin) || accountsList[0] || null;
    }
    return accountsList[0] || null;
  });

  const [checkingRedirect, setCheckingRedirect] = useState(true);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(
    activeAccount ? AppRoute.REPO_LIST : AppRoute.TOKEN_INPUT
  );
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    localStorage.setItem('gh_accounts', JSON.stringify(accounts));
    if (activeAccount) {
      localStorage.setItem('gh_active_account_login', activeAccount.user.login);
    } else {
      localStorage.removeItem('gh_active_account_login');
    }
  }, [accounts, activeAccount]);

  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await handleRedirectResult();
        if (result) {
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
    const newAccount: Account = { user: newUser, token: newToken };

    setAccounts(prevAccounts => {
      const existingAccountIndex = prevAccounts.findIndex(acc => acc.user.login === newUser.login);
      if (existingAccountIndex > -1) {
        const updatedAccounts = [...prevAccounts];
        updatedAccounts[existingAccountIndex] = newAccount;
        return updatedAccounts;
      } else {
        return [...prevAccounts, newAccount];
      }
    });

    setActiveAccount(newAccount);
    setCurrentRoute(AppRoute.REPO_LIST);
  };

  const handleLogout = async () => {
    if (!activeAccount) return;

    try {
      await signOutFromFirebase();
    } catch (err) {
      console.error('Firebase sign out error:', err);
    }
    
    const newAccounts = accounts.filter(acc => acc.user.login !== activeAccount.user.login);
    setAccounts(newAccounts);

    if (newAccounts.length > 0) {
      setActiveAccount(newAccounts[0]);
    } else {
      setActiveAccount(null);
      setCurrentRoute(AppRoute.TOKEN_INPUT);
    }

    setSelectedRepo(null);
  };

  const switchAccount = (login: string) => {
    const accountToSwitch = accounts.find(acc => acc.user.login === login);
    if (accountToSwitch) {
      setActiveAccount(accountToSwitch);
      setSelectedRepo(null);
      setSelectedIssue(null);
      setCurrentRoute(AppRoute.REPO_LIST);
    }
  };

  const addNewAccount = () => {
    setCurrentRoute(AppRoute.TOKEN_INPUT);
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

  if (checkingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
      </div>
    );
  }

  if (currentRoute === AppRoute.TOKEN_INPUT || !activeAccount) {
    return <TokenGate onSuccess={handleLogin} hasAccounts={accounts.length > 0} onBack={() => setCurrentRoute(AppRoute.REPO_LIST)} />;
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
      activeAccount={activeAccount}
      accounts={accounts}
      onRepoSelect={navigateToRepo}
      onLogout={handleLogout}
      onSwitchAccount={switchAccount}
      onAddNewAccount={addNewAccount}
    />
  );
};

const AppWithProviders: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWithProviders;
