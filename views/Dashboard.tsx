import { createEffect, onMount } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { Repository, GitHubUser, RepoDraft, Issue } from '../types';
import { fetchRepositories, createRepository, deleteRepository, setRepositorySecret } from '../services/githubService';
import { RepoCard } from '../components/RepoCard';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { ThemeToggle } from '../components/ThemeToggle';
import { LogOut, RefreshCw, Plus, X, Lock, Globe, AlertTriangle, Key } from 'lucide-react';
import { getCached, setCache, CacheKeys } from '../services/cacheService';

interface DashboardProps {
  token: string;
  user: GitHubUser;
  onRepoSelect: (repo: Repository) => void;
  onLogout: () => void | Promise<void>;
}

export const Dashboard = (props: DashboardProps) => {
  const { toasts, dismissToast, showError } = useToast();

  const state = createMutable({
    repos: getCached<Repository[]>(CacheKeys.repos()) || [],
    loading: !getCached<Repository[]>(CacheKeys.repos()),
    isRefreshing: false,
    error: '',
    pinnedRepoIds: (() => {
      const saved = localStorage.getItem('pinnedRepos');
      return saved ? new Set(JSON.parse(saved)) : new Set<number>();
    })(),
    repoIssues: (() => {
      const cachedRepos = getCached<Repository[]>(CacheKeys.repos());
      if (!cachedRepos) return {};

      const issuesMap: Record<number, Issue[]> = {};
      for (const repo of cachedRepos.slice(0, 4)) {
        const cachedIssues = getCached<Issue[]>(CacheKeys.repoIssues(repo.owner.login, repo.name));
        if (cachedIssues) {
          issuesMap[repo.id] = cachedIssues.filter(issue => !issue.pull_request).slice(0, 3);
        }
      }
      return issuesMap;
    })(),
    isInitialMount: true,
    newRepo: { name: '', description: '', private: false, auto_init: true },
    autoSetOAuthToken: true,
    isCreateModalOpen: false,
    isCreating: false,
    isDeleteModalOpen: false,
    isDeleting: false,
    repoToDelete: null as Repository | null,
  });
  
  // Create Repo Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newRepo, setNewRepo] = useState<RepoDraft>({
    name: '',
    description: '',
    private: false,
    auto_init: true
  });
  const [autoSetOAuthToken, setAutoSetOAuthToken] = useState(true);

  // Delete Repo Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);

  // Close modals on Escape key
  createEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (state.isDeleteModalOpen) closeDeleteModal();
        if (state.isCreateModalOpen) state.isCreateModalOpen = false;
      }
    };
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
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
      // Cache the repos for instant display on next visit
      setCache(CacheKeys.repos(), data);

      // Load issues for first 4 repos - reuse cache when available
      const reposToShow = data.slice(0, 4);
      const issuesMap: Record<number, Issue[]> = {};

      for (const repo of reposToShow) {
        const cacheKey = CacheKeys.repoIssues(repo.owner.login, repo.name);
        const cachedIssues = getCached<Issue[]>(cacheKey);

        if (cachedIssues) {
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
    // Always fetch fresh data on mount, but show cached immediately
    loadRepos(false);
    state.isInitialMount = false;
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
      state.repoToDelete = null;

      // Remove the repo from the list
      state.repos = state.repos.filter(r => r.id !== state.repoToDelete!.id);

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
    const newSet = new Set(state.pinnedRepoIds);
    if (newSet.has(repo.id)) {
      newSet.delete(repo.id);
    } else {
      newSet.add(repo.id);
    }
    localStorage.setItem('pinnedRepos', JSON.stringify([...newSet]));
    state.pinnedRepoIds = newSet;
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <img src={props.user.avatar_url} alt={props.user.login} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600" />
             <span className="font-semibold text-slate-900 dark:text-slate-100">{props.user.login}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={props.onLogout} icon={<LogOut size={16} />}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your Repositories</h2>
          <div className="flex gap-2 items-center">
            {state.isRefreshing && (
              <span className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>
            )}
            <Button variant="secondary" onClick={() => loadRepos(true)} icon={<RefreshCw size={16} className={state.isRefreshing ? 'animate-spin' : ''} />} disabled={state.isRefreshing}>
              Refresh
            </Button>
            <Button variant="primary" onClick={() => state.isCreateModalOpen = true} icon={<Plus size={16} />}>
              New Repo
            </Button>
          </div>
        </div>

        {state.error && (
           <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg mb-6 border border-red-200 dark:border-red-800">
             {state.error}
           </div>
        )}

        {state.loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedRepos().map((repo) => (
              <RepoCard
                repo={repo}
                onClick={props.onRepoSelect}
                onDelete={handleDeleteClick}
                onPin={handlePinRepo}
                isPinned={state.pinnedRepoIds.has(repo.id)}
                issues={state.repoIssues[repo.id]}
              />
            ))}
            {state.repos.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                    No repositories found.
                </div>
            )}
          </div>
        )}
      </main>

      {/* Create Repo Modal */}
      {state.isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => state.isCreateModalOpen = false}
        >
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create Repository</h2>
                 <button onClick={() => state.isCreateModalOpen = false} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>

              <form onSubmit={handleCreateRepo} className="p-6 space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repository Name</label>
                    <input
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={state.newRepo.name}
                      onInput={e => state.newRepo.name = (e.target as HTMLInputElement).value}
                      placeholder="e.g., awesome-project"
                      required
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                      value={state.newRepo.description}
                      onInput={e => state.newRepo.description = (e.target as HTMLTextAreaElement).value}
                      placeholder="What is this project about?"
                    />
                 </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                      <div className="flex items-center gap-3">
                        <Globe size={20} className="text-slate-500 dark:text-slate-400" />
                        <div>
                          <span className="block font-medium text-slate-700 dark:text-slate-200">Public</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">Anyone on the internet can see this repository</span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="visibility"
                        checked={!state.newRepo.private}
                        onChange={() => state.newRepo.private = false}
                        className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                      <div className="flex items-center gap-3">
                        <Lock size={20} className="text-slate-500 dark:text-slate-400" />
                        <div>
                          <span className="block font-medium text-slate-700 dark:text-slate-200">Private</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">You choose who can see and commit to this repository</span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="visibility"
                        checked={state.newRepo.private}
                        onChange={() => state.newRepo.private = true}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                     <input
                       type="checkbox"
                       id="auto_init"
                       checked={state.newRepo.auto_init}
                       onChange={(e) => state.newRepo.auto_init = (e.target as HTMLInputElement).checked}
                       className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                     />
                     <label htmlFor="auto_init" className="text-sm text-slate-700 dark:text-slate-300">Initialize with a README</label>
                  </div>

                  {/* Auto-set OAUTH_TOKEN */}
                  <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                     <label className="flex items-center gap-3 cursor-pointer">
                       <input
                         type="checkbox"
                         checked={state.autoSetOAuthToken}
                         onChange={(e) => state.autoSetOAuthToken = (e.target as HTMLInputElement).checked}
                         className="w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-600 rounded focus:ring-emerald-500"
                       />
                       <div className="flex items-center gap-2">
                         <Key size={16} className="text-emerald-600 dark:text-emerald-400" />
                         <div>
                           <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Auto-set OAUTH_TOKEN secret</span>
                           <p className="text-xs text-slate-500 dark:text-slate-400">Adds your token as a repository secret for GitHub Actions</p>
                         </div>
                       </div>
                     </label>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                     <Button type="button" variant="ghost" onClick={() => state.isCreateModalOpen = false}>Cancel</Button>
                     <Button type="submit" variant="primary" isLoading={state.isCreating}>Create Repository</Button>
                  </div>
               </form>
            </div>
         </div>
       )}

      {/* Delete Repo Modal */}
      {state.isDeleteModalOpen && state.repoToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                     <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Delete Repository</h2>
                 </div>
                 <button onClick={closeDeleteModal} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>

              <div className="p-6 space-y-4">
                 <p className="text-slate-600 dark:text-slate-300">
                   Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-100">{state.repoToDelete.owner.login}/{state.repoToDelete.name}</strong>?
                 </p>

                 <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-300 text-sm">
                      <strong>Warning:</strong> This action cannot be undone.
                    </p>
                 </div>

                 <div className="pt-2 flex justify-end gap-3">
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
      )}
    </div>
  );
};
