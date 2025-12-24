import { Component } from 'solid-js';
import { Repository, Issue } from '../types';

interface RepoDetailProps {
  token: string;
  repo: Repository;
  onBack: () => void;
  onIssueSelect: (issue: Issue) => void;
}

export const RepoDetail: Component<RepoDetailProps> = (props) => {
  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div class="max-w-7xl mx-auto">
        <button 
          onClick={props.onBack}
          class="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          ← Back
        </button>
        <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
          {props.repo.name}
        </h1>
        <p class="text-slate-600 dark:text-slate-400 mt-2">
          Repository details view - Full conversion in progress
        </p>
      </div>
    </div>
  );
};
