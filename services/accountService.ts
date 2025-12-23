// Account management service for handling multiple GitHub accounts

import { GitHubUser } from '../types';

const ACCOUNTS_KEY = 'gh_accounts';
const ACTIVE_ACCOUNT_KEY = 'gh_active_account';

export interface Account {
  id: string; // Unique identifier (GitHub user login)
  token: string;
  user: GitHubUser;
  addedAt: number;
}

interface AccountsData {
  accounts: Account[];
  activeAccountId: string | null;
}

/**
 * Get all stored accounts
 */
export function getAccounts(): Account[] {
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    if (!data) return [];
    const parsed: AccountsData = JSON.parse(data);
    return parsed.accounts || [];
  } catch {
    return [];
  }
}

/**
 * Get the currently active account ID
 */
export function getActiveAccountId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

/**
 * Get the currently active account
 */
export function getActiveAccount(): Account | null {
  const accounts = getAccounts();
  const activeId = getActiveAccountId();
  
  if (!activeId) {
    // If no active account set but we have accounts, return the first one
    return accounts.length > 0 ? accounts[0] : null;
  }
  
  return accounts.find(acc => acc.id === activeId) || null;
}

/**
 * Add or update an account
 */
export function addAccount(token: string, user: GitHubUser): Account {
  const accounts = getAccounts();
  const accountId = user.login;
  
  // Check if account already exists
  const existingIndex = accounts.findIndex(acc => acc.id === accountId);
  
  const account: Account = {
    id: accountId,
    token,
    user,
    addedAt: Date.now(),
  };
  
  if (existingIndex >= 0) {
    // Update existing account
    accounts[existingIndex] = account;
  } else {
    // Add new account
    accounts.push(account);
  }
  
  // Save accounts
  const data: AccountsData = {
    accounts,
    activeAccountId: getActiveAccountId() || accountId,
  };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(data));
  
  // If this is the first account or no active account, make it active
  if (!getActiveAccountId()) {
    setActiveAccount(accountId);
  }
  
  return account;
}

/**
 * Remove an account
 */
export function removeAccount(accountId: string): void {
  const accounts = getAccounts();
  const filtered = accounts.filter(acc => acc.id !== accountId);
  
  const data: AccountsData = {
    accounts: filtered,
    activeAccountId: getActiveAccountId(),
  };
  
  // If we removed the active account, switch to another one
  if (getActiveAccountId() === accountId) {
    const newActiveId = filtered.length > 0 ? filtered[0].id : null;
    data.activeAccountId = newActiveId;
    if (newActiveId) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, newActiveId);
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  }
  
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(data));
  
  // Clear cache for this account
  clearAccountCache(accountId);
}

/**
 * Set the active account
 */
export function setActiveAccount(accountId: string): boolean {
  const accounts = getAccounts();
  const account = accounts.find(acc => acc.id === accountId);
  
  if (!account) {
    return false;
  }
  
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  return true;
}

/**
 * Clear all accounts
 */
export function clearAllAccounts(): void {
  localStorage.removeItem(ACCOUNTS_KEY);
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  
  // Clear all account caches
  const accounts = getAccounts();
  accounts.forEach(acc => clearAccountCache(acc.id));
}

/**
 * Clear cache for a specific account
 */
function clearAccountCache(accountId: string): void {
  const prefix = `vibe_github_cache_${accountId}_`;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Migrate old single-account data to new multi-account structure
 */
export function migrateOldAccountData(): void {
  // Check if we already have accounts
  if (getAccounts().length > 0) {
    return; // Already migrated
  }
  
  // Check for old single-account data
  const oldToken = localStorage.getItem('gh_token');
  const oldUserData = localStorage.getItem('gh_user');
  
  if (oldToken && oldUserData) {
    try {
      const user: GitHubUser = JSON.parse(oldUserData);
      addAccount(oldToken, user);
      
      // Remove old data
      localStorage.removeItem('gh_token');
      localStorage.removeItem('gh_user');
    } catch (err) {
      console.error('Failed to migrate old account data:', err);
    }
  }
}
