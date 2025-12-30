import { Component, For, Show, onMount, onCleanup, createEffect } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { Repository, GitHubUser, RepoDraft, Issue } from '../types';
import { fetchRepositories, createRepository, deleteRepository, setRepositorySecret } from '../services/githubService';
import { RepoCard } from '../components/RepoCard';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { ThemeToggle } from '../components/ThemeToggle';
import { LogOut, RefreshCw, Plus, X, Lock, Globe, AlertTriangle, Key } from 'lucide-solid';
import { cache } from '../store';

interface DashboardProps {
  token: string;
  user: GitHubUser;
  onRepoSelect: (repo: Repository) => void;
  onLogout: () => void | Promise<void>;
}

export const Dashboard: Component<DashboardProps> = (props) => {
  const { toasts, dismissToast, showError } = useToast();
  
  // Initialize from cache for instant display - Proxy automatically loads from cache
  const cachedRepos = cache.repos;
  const hasCachedRepos = cachedRepos.length > 0;
  
  const state = createMutable({
    repos: cachedRepos,
    loading: !hasCachedRepos,
    isRefreshing: false,
    error: '',
    pinnedRepoIds: (() => {
      const saved = localStorage.getItem('pinnedRepos');
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
    })(),
    repoIssues: (() => {
      if (!hasCachedRepos) return {} as Record<number, Issue[]>;
      
      const issuesMap: Record<number, Issue[]> = {};
      for (const repo of cachedRepos.slice(0, 4)) {
        const cachedIssues = cache.repoIssues(repo.owner.login, repo.name);
        if (cachedIssues && cachedIssues.length > 0) {
          issuesMap[repo.id] = cachedIssues.filter(issue => !issue.pull_request).slice(0, 3);
        }
      }
      return issuesMap;
    })(),
    // Create Repo Modal State
    isCreateModalOpen: false,
    isCreating: false,
    newRepo: {
      name: '',
      description: '',
      private: false,
      auto_init: true
    } as RepoDraft,
    autoSetOAuthToken: true,
    // Delete Repo Modal State
    isDeleteModalOpen: false,
    isDeleting: false,
    repoToDelete: null as Repository | null,
  });

  const loadRepos = async (isManualRefresh = false) => {
    const hasCachedData = state.repos.length > 0;
    
    // Show full loading only on first load with no cache
    // Otherwise show subtle refresh indicator
    if (!hasCachedData) {
      state.loading = true;
    } else if (isManualRefresh) {
      state.isRefreshing = true;
    }
    
    state.error = '';
    try {
      const data = await fetchRepositories(props.token);
      state.repos = data;
      // Proxy automatically caches on assignment
      cache.repos = data;
      
      // Load issues for first 4 repos - reuse cache when available
      const reposToShow = data.slice(0, 4);
      const issuesMap: Record<number, Issue[]> = {};
      
      for (const repo of reposToShow) {
        const cachedIssues = cache.repoIssues(repo.owner.login, repo.name);
        
        if (cachedIssues && cachedIssues.length > 0) {
          // Reuse cached issues - filter to actual issues (not PRs) and take first 3
          const actualIssues = cachedIssues.filter(issue => !issue.pull_request).slice(0, 3);
          issuesMap[repo.id] = actualIssues;
        }
        // If not cached, leave empty - issues will be cached when user visits repo detail
      }
      
      state.repoIssues = issuesMap;
    } catch (err) {
      // Only show error if we don't have cached data to display
      if (!hasCachedData) {
        state.error = 'Failed to load repositories.';
      }
    } finally {
      state.loading = false;
      state.isRefreshing = false;
    }
  };

  onMount(() => {
    loadRepos(false);
  });

  // Close modals on Escape key
  onMount(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state.isDeleteModalOpen) closeDeleteModal();
        if (state.isCreateModalOpen) state.isCreateModalOpen = false;
      }
    };
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
  });

  const handleCreateRepo = async (e: Event) => {
    e.preventDefault();
    if (!state.newRepo.name) return;

    state.isCreating = true;
    try {
      const createdRepo = await createRepository(props.token, state.newRepo);
      
      // Auto-set OAUTH_TOKEN secret if checkbox is checked
      if (state.autoSetOAuthToken) {
        try {
          // Small delay to ensure repo is fully created
          await new Promise(resolve => setTimeout(resolve, 500));
          await setRepositorySecret(props.token, createdRepo.owner.login, createdRepo.name, 'OAUTH_TOKEN', props.token);
        } catch (secretErr) {
          console.warn('Failed to auto-set OAUTH_TOKEN:', secretErr);
          // Don't fail the whole operation if secret setting fails
        }
      }
      
      state.isCreateModalOpen = false;
      state.newRepo = { name: '', description: '', private: false, auto_init: true };
      state.autoSetOAuthToken = true;
      
      // Manually add the new repo to the top of the list
      state.repos = [createdRepo, ...state.repos];
      
    } catch (err) {
      showError("Failed to create repository. Note: You need 'repo' scope token permissions.");
    } finally {
      state.isCreating = false;
    }
  };

  const handleDeleteClick = (repo: Repository) => {
    state.repoToDelete = repo;
    state.isDeleteModalOpen = true;
  };

  const handleDeleteRepo = async () => {
    if (!state.repoToDelete) return;

    state.isDeleting = true;
    try {
      await deleteRepository(props.token, state.repoToDelete.owner.login, state.repoToDelete.name);
      state.isDeleteModalOpen = false;
      const deletedId = state.repoToDelete.id;
      state.repoToDelete = null;
      
      // Remove the repo from the list
      state.repos = state.repos.filter(r => r.id !== deletedId);
      
    } catch (err) {
      showError("Failed to delete repository. Note: You need 'delete_repo' scope token permissions.");
    } finally {
      state.isDeleting = false;
    }
  };

  const closeDeleteModal = () => {
    state.isDeleteModalOpen = false;
    state.repoToDelete = null;
  };

  const handlePinRepo = (repo: Repository) => {
    if (state.pinnedRepoIds.has(repo.id)) {
      state.pinnedRepoIds.delete(repo.id);
    } else {
      state.pinnedRepoIds.add(repo.id);
    }
    localStorage.setItem('pinnedRepos', JSON.stringify([...state.pinnedRepoIds]));
  };

  // Sort repos with pinned ones first
  const sortedRepos = () => {
    return [...state.repos].sort((a, b) => {
      const aPinned = state.pinnedRepoIds.has(a.id);
      const bPinned = state.pinnedRepoIds.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  };

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Header */}
      <header class="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div class="flex items-center gap-3">
             <img src={props.user.avatar_url} alt={props.user.login} class="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600" />
             <span class="font-semibold text-slate-900 dark:text-slate-100">{props.user.login}</span>
          </div>
          <div class="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={props.onLogout} icon={<LogOut size={16} />}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Your Repositories</h2>
          <div class="flex gap-2 items-center">
            <Show when={state.isRefreshing}>
              <span class="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>
            </Show>
            <Button variant="secondary" onClick={() => loadRepos(true)} icon={<RefreshCw size={16} class={state.isRefreshing ? 'animate-spin' : ''} />} disabled={state.isRefreshing}>
              Refresh
            </Button>
            <Button variant="primary" onClick={() => state.isCreateModalOpen = true} icon={<Plus size={16} />}>
              New Repo
            </Button>
          </div>
        </div>

        <Show when={state.loading}>
          <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </Show>

        <Show when={state.error}>
          <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
            {state.error}
          </div>
        </Show>

        <Show when={!state.loading && !state.error}>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={sortedRepos()}>
              {(repo) => (
                <RepoCard 
                  repo={repo} 
                  onClick={props.onRepoSelect} 
                  onDelete={handleDeleteClick}
                  onPin={handlePinRepo}
                  isPinned={state.pinnedRepoIds.has(repo.id)}
                  issues={state.repoIssues[repo.id]}
                />
              )}
            </For>
            <Show when={state.repos.length === 0}>
              <div class="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                No repositories found.
              </div>
            </Show>
          </div>
        </Show>
      </main>

      {/* Create Repo Modal */}
      <Show when={state.isCreateModalOpen}>
        <div 
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => state.isCreateModalOpen = false}
        >
           <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Create Repository</h2>
                 <button onClick={() => state.isCreateModalOpen = false} class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>
              
              <form onSubmit={handleCreateRepo} class="p-6 space-y-4">
                 <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repository Name</label>
                    <input 
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={state.newRepo.name}
                      onInput={(e) => state.newRepo.name = e.currentTarget.value}
                      placeholder="e.g., awesome-project"
                      required
                    />
                 </div>
                 
                 <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description <span class="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
                    <textarea 
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                      value={state.newRepo.description}
                      onInput={(e) => state.newRepo.description = e.currentTarget.value}
                      placeholder="What is this project about?"
                    />
                 </div>

                 <div class="space-y-3">
                   <label class="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                     <div class="flex items-center gap-3">
                       <Globe size={20} class="text-slate-500 dark:text-slate-400" />
                       <div>
                         <span class="block font-medium text-slate-700 dark:text-slate-200">Public</span>
                         <span class="block text-xs text-slate-500 dark:text-slate-400">Anyone on the internet can see this repository</span>
                       </div>
                     </div>
                     <input 
                       type="radio" 
                       name="visibility"
                       checked={!state.newRepo.private}
                       onChange={() => state.newRepo.private = false}
                       class="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                     />
                   </label>

                   <label class="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                     <div class="flex items-center gap-3">
                       <Lock size={20} class="text-slate-500 dark:text-slate-400" />
                       <div>
                         <span class="block font-medium text-slate-700 dark:text-slate-200">Private</span>
                         <span class="block text-xs text-slate-500 dark:text-slate-400">You choose who can see and commit to this repository</span>
                       </div>
                     </div>
                     <input 
                       type="radio" 
                       name="visibility"
                       checked={state.newRepo.private}
                       onChange={() => state.newRepo.private = true}
                       class="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                     />
                   </label>
                 </div>
                 
                 <div class="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox"
                      id="auto_init"
                      checked={state.newRepo.auto_init}
                      onChange={(e) => state.newRepo.auto_init = e.currentTarget.checked}
                      class="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                    />
                    <label for="auto_init" class="text-sm text-slate-700 dark:text-slate-300">Initialize with a README</label>
                 </div>

                 {/* Auto-set OAUTH_TOKEN */}
                 <div class="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={state.autoSetOAuthToken}
                        onChange={(e) => state.autoSetOAuthToken = e.currentTarget.checked}
                        class="w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-600 rounded focus:ring-emerald-500"
                      />
                      <div class="flex items-center gap-2">
                        <Key size={16} class="text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Auto-set OAUTH_TOKEN secret</span>
                          <p class="text-xs text-slate-500 dark:text-slate-400">Adds your token as a repository secret for GitHub Actions</p>
                        </div>
                      </div>
                    </label>
                 </div>
                 
                 <div class="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => state.isCreateModalOpen = false}>Cancel</Button>
                    <Button type="submit" variant="primary" isLoading={state.isCreating}>Create Repository</Button>
                 </div>
              </form>
           </div>
        </div>
      </Show>

      {/* Delete Repo Modal */}
      <Show when={state.isDeleteModalOpen && state.repoToDelete}>
        <div 
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
           <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <div class="flex items-center gap-3">
                   <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                     <AlertTriangle size={20} class="text-red-600 dark:text-red-400" />
                   </div>
                   <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Delete Repository</h2>
                 </div>
                 <button onClick={closeDeleteModal} class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>
              
              <div class="p-6 space-y-4">
                 <p class="text-slate-600 dark:text-slate-300">
                   Are you sure you want to delete <strong class="text-slate-800 dark:text-slate-100">{state.repoToDelete?.owner.login}/{state.repoToDelete?.name}</strong>?
                 </p>
                 
                 <div class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <p class="text-red-800 dark:text-red-300 text-sm">
                      <strong>Warning:</strong> This action cannot be undone.
                    </p>
                 </div>
                 
                 <div class="pt-2 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={closeDeleteModal}>Cancel</Button>
                    <Button 
                      type="button" 
                      variant="danger" 
                      onClick={handleDeleteRepo}
                      isLoading={state.isDeleting}
                    >
                      Delete
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </Show>
    </div>
  );
};
