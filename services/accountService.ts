import { Account, GitHubUser } from '../types';

const ACCOUNTS_KEY = 'gh_accounts';
const ACTIVE_ACCOUNT_KEY = 'gh_active_account_id';

/**
 * Get all stored accounts
 */
export function getAllAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Add a new account or update existing one
 */
export function addAccount(token: string, user: GitHubUser): Account {
  const accounts = getAllAccounts();
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
  
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  return account;
}

/**
 * Remove an account
 */
export function removeAccount(accountId: string): void {
  const accounts = getAllAccounts();
  const filtered = accounts.filter(acc => acc.id !== accountId);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered));
  
  // If the removed account was active, clear active account
  const activeId = getActiveAccountId();
  if (activeId === accountId) {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

/**
 * Get the active account ID
 */
export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

/**
 * Set the active account
 */
export function setActiveAccount(accountId: string): void {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
}

/**
 * Get the active account
 */
export function getActiveAccount(): Account | null {
  const activeId = getActiveAccountId();
  if (!activeId) return null;
  
  const accounts = getAllAccounts();
  return accounts.find(acc => acc.id === activeId) || null;
}

/**
 * Clear all accounts (for logout all)
 */
export function clearAllAccounts(): void {
  localStorage.removeItem(ACCOUNTS_KEY);
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}

/**
 * Migrate legacy single account to new multi-account system
 * This ensures users who were already logged in don't lose their session
 */
export function migrateLegacyAccount(): void {
  // Check if we already have accounts
  const accounts = getAllAccounts();
  if (accounts.length > 0) {
    return; // Already migrated or has accounts
  }
  
  // Check for legacy single account
  const legacyToken = localStorage.getItem('gh_token');
  const legacyUserRaw = localStorage.getItem('gh_user');
  
  if (legacyToken && legacyUserRaw) {
    try {
      const legacyUser = JSON.parse(legacyUserRaw);
      const account = addAccount(legacyToken, legacyUser);
      setActiveAccount(account.id);
      
      // Clean up legacy storage
      localStorage.removeItem('gh_token');
      localStorage.removeItem('gh_user');
    } catch {
      // If migration fails, just ignore
    }
  }
}
