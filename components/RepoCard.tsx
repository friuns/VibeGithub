import React from 'react';
import { Repository, Issue } from '../types';
import { Star, Lock, Globe, Trash2, Pin, CircleDot } from 'lucide-react';

interface RepoCardProps {
  repo: Repository;
  onClick: (repo: Repository) => void;
  onDelete?: (repo: Repository) => void;
  onPin?: (repo: Repository) => void;
  isPinned?: boolean;
  issues?: Issue[];
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo, onClick, onDelete, onPin, isPinned, issues }) => {
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(repo);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPin?.(repo);
  };

  return (
    <div 
      onClick={() => onClick(repo)}
      className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow cursor-pointer flex flex-col h-full group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
           {repo.private ? <Lock size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> : <Globe size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />}
           <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 break-all">{repo.name}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onPin && (
            <button
              onClick={handlePinClick}
              className={`p-1.5 rounded-md transition-all ${
                isPinned 
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 opacity-0 group-hover:opacity-100'
              }`}
              title={isPinned ? "Unpin repository" : "Pin repository"}
            >
              <Pin size={16} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md opacity-0 group-hover:opacity-100 transition-all"
              title="Delete repository"
            >
              <Trash2 size={16} />
            </button>
          )}
          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-600">
            {repo.language || 'Text'}
          </span>
        </div>
      </div>
      
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-3 line-clamp-2">
        {repo.description || "No description provided."}
      </p>

      {issues && issues.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {issues.map((issue) => (
            <div 
              key={issue.id} 
              className="flex items-start gap-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(issue.html_url, '_blank');
              }}
            >
              <CircleDot 
                size={12} 
                className={`mt-0.5 flex-shrink-0 ${issue.state === 'open' ? 'text-green-500' : 'text-purple-500'}`} 
              />
              <span className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate cursor-pointer">
                {issue.title}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <Star size={14} />
          <span>{repo.stargazers_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>{new Date(repo.updated_at).toLocaleDateString()}</span>
        </div>
        <div className="ml-auto text-xs text-slate-400 dark:text-slate-500">
            {repo.open_issues_count} issues
        </div>
      </div>
    </div>
  );
};
