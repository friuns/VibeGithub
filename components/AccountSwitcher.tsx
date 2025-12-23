import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, X } from 'lucide-react';
import { Account } from '../services/accountService';

interface AccountSwitcherProps {
  accounts: Account[];
  currentAccount: Account;
  onSwitch: (accountId: string) => void;
  onAddAccount: () => void;
  onRemoveAccount: (accountId: string) => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  accounts,
  currentAccount,
  onSwitch,
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

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleRemoveAccount = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();
    onRemoveAccount(accountId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Account Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <img 
          src={currentAccount.user.avatar_url} 
          alt={currentAccount.user.login} 
          className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-600"
        />
        <span className="font-medium text-slate-900 dark:text-slate-100 hidden sm:inline">
          {currentAccount.user.login}
        </span>
        {accounts.length > 1 && (
          <ChevronDown 
            size={16} 
            className={`text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
          {/* Accounts List */}
          <div className="px-2 mb-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-2">
              ACCOUNTS
            </div>
            {accounts.map(account => (
              <div
                key={account.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer group ${
                  account.id === currentAccount.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                onClick={() => {
                  if (account.id !== currentAccount.id) {
                    onSwitch(account.id);
                    setIsOpen(false);
                  }
                }}
              >
                <img
                  src={account.user.avatar_url}
                  alt={account.user.login}
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {account.user.login}
                  </div>
                  {account.user.name && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {account.user.name}
                    </div>
                  )}
                </div>
                {account.id === currentAccount.id ? (
                  <Check size={16} className="text-blue-600 dark:text-blue-400" />
                ) : (
                  accounts.length > 1 && (
                    <button
                      onClick={(e) => handleRemoveAccount(e, account.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                      title="Remove account"
                      aria-label={`Remove account ${account.user.login}`}
                    >
                      <X size={14} className="text-red-600 dark:text-red-400" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>

          {/* Add Account Button */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-2 px-2">
            <button
              onClick={() => {
                onAddAccount();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">Add Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
