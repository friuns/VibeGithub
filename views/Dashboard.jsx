import { createSignal, createEffect, onMount, For } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { fetchRepositories, createRepository, deleteRepository, setRepositorySecret } from '../services/githubService';
import { RepoCard } from '../components/RepoCard';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { ThemeToggle } from '../components/ThemeToggle';
import { LogOut, RefreshCw, Plus, X, Lock, Globe, AlertTriangle, Key } from 'lucide-solid';
import { getCached, setCache, CacheKeys } from '../services/cacheService';

export const Dashboard = (props) => {
  const { toasts, dismissToast, showError } = useToast();

  const state = createMutable({
    repos: getCached(CacheKeys.repos()) || [],
    repoIssues: {},
    loading: !getCached(CacheKeys.repos()),
    isRefreshing: false,
    error: '',
    pinnedRepoIds: new Set(JSON.parse(localStorage.getItem('pinnedRepos') || '[]')),
    isCreateModalOpen: false,
    isCreating: false,
    newRepo: {
      name: '',
      description: '',
      private: false,
      auto_init: true
    },
    autoSetOAuthToken: true,
    isDeleteModalOpen: false,
    isDeleting: false,
    repoToDelete: null,
  });

  const loadRepos = async (isManualRefresh = false) => {
    const hasCachedData = state.repos.length > 0;

    if (!hasCachedData) {
      state.loading = true;
    } else if (isManualRefresh) {
      state.isRefreshing = true;
    }

    state.error = '';
    try {
      const data = await fetchRepositories(props.token);
      state.repos = data;
      setCache(CacheKeys.repos(), data);

      const reposToShow = data.slice(0, 4);
      const issuesMap = {};

      for (const repo of reposToShow) {
        const cacheKey = CacheKeys.repoIssues(repo.owner.login, repo.name);
        const cachedIssues = getCached(cacheKey);

        if (cachedIssues) {
          const actualIssues = cachedIssues.filter(issue => !issue.pull_request).slice(0, 3);
          issuesMap[repo.id] = actualIssues;
        }
      }

      state.repoIssues = issuesMap;
    } catch (err) {
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

  const handleCreateRepo = async (e) => {
    e.preventDefault();
    if (!state.newRepo.name) return;

    state.isCreating = true;
    try {
      const createdRepo = await createRepository(props.token, state.newRepo);

      if (state.autoSetOAuthToken) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          await setRepositorySecret(props.token, createdRepo.owner.login, createdRepo.name, 'OAUTH_TOKEN', props.token);
        } catch (secretErr) {
          console.warn('Failed to auto-set OAUTH_TOKEN:', secretErr);
        }
      }

      state.isCreateModalOpen = false;
      state.newRepo = { name: '', description: '', private: false, auto_init: true };
      state.autoSetOAuthToken = true;
      state.repos.unshift(createdRepo);
    } catch (err) {
      showError("Failed to create repository. Note: You need 'repo' scope token permissions.");
    } finally {
      state.isCreating = false;
    }
  };

  const handleDeleteClick = (repo) => {
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
      state.repos = state.repos.filter(r => r.id !== state.repoToDelete.id);
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

  const handlePinRepo = (repo) => {
    const newSet = new Set(state.pinnedRepoIds);
    if (newSet.has(repo.id)) {
      newSet.delete(repo.id);
    } else {
      newSet.add(repo.id);
    }
    localStorage.setItem('pinnedRepos', JSON.stringify([...newSet]));
    state.pinnedRepoIds = newSet;
  };

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

        <Show when={state.error}>
           <div class="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg mb-6 border border-red-200 dark:border-red-800">
             {state.error}
           </div>
        </Show>

        <Show when={state.loading} fallback={
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={sortedRepos()}>{(repo) =>
              <RepoCard
                repo={repo}
                onClick={props.onRepoSelect}
                onDelete={handleDeleteClick}
                onPin={handlePinRepo}
                isPinned={state.pinnedRepoIds.has(repo.id)}
                issues={state.repoIssues[repo.id]}
              />
            }</For>
            <Show when={state.repos.length === 0}>
                <div class="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                    No repositories found.
                </div>
            </Show>
          </div>
        }>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={[1, 2, 3, 4, 5, 6]}>{(_) =>
              <div class="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
            }</For>
          </div>
        </Show>
      </main>

      <Show when={state.isCreateModalOpen}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => state.isCreateModalOpen = false}
        >
           <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
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
                      onInput={e => state.newRepo.name = e.target.value}
                      placeholder="e.g., awesome-project"
                      required
                    />
                 </div>

                 <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description <span class="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
                    <textarea
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                      value={state.newRepo.description}
                      onInput={e => state.newRepo.description = e.target.value}
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
                      onChange={(e) => state.newRepo.auto_init = e.target.checked}
                      class="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                    />
                    <label for="auto_init" class="text-sm text-slate-700 dark:text-slate-300">Initialize with a README</label>
                 </div>

                 <div class="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.autoSetOAuthToken}
                        onChange={(e) => state.autoSetOAuthToken = e.target.checked}
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

      <Show when={state.isDeleteModalOpen && state.repoToDelete}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
           <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
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
                   Are you sure you want to delete <strong class="text-slate-800 dark:text-slate-100">{state.repoToDelete.owner.login}/{state.repoToDelete.name}</strong>?
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
