import React, { useState, useRef, useEffect } from 'react';
import { Account } from '../types';
import { ChevronDown, UserPlus, LogOut, Check } from 'lucide-react';

interface AccountSwitcherProps {
  accounts: Account[];
  activeAccount: Account;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onRemoveAccount: (accountId: string) => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  accounts,
  activeAccount,
  onSwitchAccount,
  onAddAccount,
  onRemoveAccount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchAccount = (accountId: string) => {
    onSwitchAccount(accountId);
    setIsOpen(false);
  };

  const handleRemoveAccount = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();
    onRemoveAccount(accountId);
    // Don't close the dropdown if there are still accounts
    if (accounts.length <= 1) {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600"
      >
        <img 
          src={activeAccount.user.avatar_url} 
          alt={activeAccount.user.login} 
          className="w-6 h-6 rounded-full"
        />
        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
          {activeAccount.user.login}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
          {/* Account List */}
          <div className="px-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 mb-1">
              ACCOUNTS
            </div>
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer group"
              >
                <div
                  onClick={() => handleSwitchAccount(account.id)}
                  className="flex items-center gap-2 flex-1"
                >
                  <img 
                    src={account.user.avatar_url} 
                    alt={account.user.login} 
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {account.user.name || account.user.login}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      @{account.user.login}
                    </div>
                  </div>
                  {account.id === activeAccount.id && (
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                {accounts.length > 1 && (
                  <button
                    onClick={(e) => handleRemoveAccount(e, account.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity focus:opacity-100"
                    title="Remove account"
                    aria-label={`Remove account ${account.user.login}`}
                  >
                    <LogOut size={14} className="text-red-600 dark:text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Account */}
          <div className="px-2 pt-2">
            <button
              onClick={() => {
                onAddAccount();
                setIsOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              <UserPlus size={16} />
              <span className="text-sm font-medium">Add Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
