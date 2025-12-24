import React, { useEffect, useState, useRef } from 'react';
import { Repository, GitHubUser, RepoDraft, Issue } from '../types';
import { fetchRepositories, createRepository, deleteRepository, setRepositorySecret, copySetupWorkflowAndRun } from '../services/githubService';
import { RepoCard } from '../components/RepoCard';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { ThemeToggle } from '../components/ThemeToggle';
import { LogOut, RefreshCw, Plus, X, Lock, Globe, AlertTriangle, Key, FileCode } from 'lucide-react';
import { getCached, setCache, CacheKeys } from '../services/cacheService';

// Vite template options
const VITE_TEMPLATES = [
  { value: 'react-ts', label: 'React + TypeScript', description: 'React 18 with TypeScript and Vite' },
  { value: 'react', label: 'React', description: 'React 18 with JavaScript and Vite' },
  { value: 'react-swc-ts', label: 'React + TypeScript + SWC', description: 'React with SWC compiler for faster builds' },
  { value: 'react-swc', label: 'React + SWC', description: 'React with SWC compiler (JavaScript)' },
  { value: 'vue-ts', label: 'Vue + TypeScript', description: 'Vue 3 with TypeScript' },
  { value: 'vue', label: 'Vue', description: 'Vue 3 with JavaScript' },
  { value: 'preact-ts', label: 'Preact + TypeScript', description: 'Lightweight 3kB React alternative' },
  { value: 'preact', label: 'Preact', description: 'Preact with JavaScript' },
  { value: 'lit-ts', label: 'Lit + TypeScript', description: 'Simple. Fast. Web Components.' },
  { value: 'lit', label: 'Lit', description: 'Lit with JavaScript' },
  { value: 'svelte-ts', label: 'Svelte + TypeScript', description: 'Cybernetically enhanced web apps' },
  { value: 'svelte', label: 'Svelte', description: 'Svelte with JavaScript' },
  { value: 'solid-ts', label: 'Solid + TypeScript', description: 'Simple and performant reactivity' },
  { value: 'solid', label: 'Solid', description: 'Solid with JavaScript' },
  { value: 'qwik-ts', label: 'Qwik + TypeScript', description: 'Resumable framework for instant apps' },
  { value: 'qwik', label: 'Qwik', description: 'Qwik with JavaScript' },
  { value: 'vanilla-ts', label: 'Vanilla + TypeScript', description: 'Plain TypeScript starter' },
  { value: 'vanilla', label: 'Vanilla', description: 'Plain JavaScript starter' },
];

interface DashboardProps {
  token: string;
  user: GitHubUser;
  onRepoSelect: (repo: Repository) => void;
  onLogout: () => void | Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({ token, user, onRepoSelect, onLogout }) => {
  const { toasts, dismissToast, showError } = useToast();
  
  // Initialize from cache for instant display
  const [repos, setRepos] = useState<Repository[]>(() => {
    return getCached<Repository[]>(CacheKeys.repos()) || [];
  });
  const [loading, setLoading] = useState(() => {
    // Only show loading if no cached data
    return !getCached<Repository[]>(CacheKeys.repos());
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pinnedRepoIds, setPinnedRepoIds] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('pinnedRepos');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  // Initialize issues from cache for instant display
  const [repoIssues, setRepoIssues] = useState<Record<number, Issue[]>>(() => {
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
  });
  const isInitialMount = useRef(true);
  
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
  const [autoCopyWorkflows, setAutoCopyWorkflows] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('react-ts');

  // Delete Repo Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDeleteModalOpen) closeDeleteModal();
        if (isCreateModalOpen) setIsCreateModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDeleteModalOpen, isCreateModalOpen]);

  const loadRepos = React.useCallback(async (isManualRefresh = false) => {
    const hasCachedData = repos.length > 0;
    
    // Show full loading only on first load with no cache
    // Otherwise show subtle refresh indicator
    if (!hasCachedData) {
      setLoading(true);
    } else if (isManualRefresh) {
      setIsRefreshing(true);
    }
    
    setError('');
    try {
      const data = await fetchRepositories(token);
      setRepos(data);
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
      
      setRepoIssues(issuesMap);
    } catch (err) {
      // Only show error if we don't have cached data to display
      if (!hasCachedData) {
        setError('Failed to load repositories.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token, repos.length]);

  useEffect(() => {
    // Always fetch fresh data on mount, but show cached immediately
    loadRepos(false);
    isInitialMount.current = false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepo.name) return;

    setIsCreating(true);
    try {
      const createdRepo = await createRepository(token, newRepo);
      
      // Auto-set OAUTH_TOKEN secret if checkbox is checked
      if (autoSetOAuthToken) {
        try {
          // Small delay to ensure repo is fully created
          await new Promise(resolve => setTimeout(resolve, 500));
          await setRepositorySecret(token, createdRepo.owner.login, createdRepo.name, 'OAUTH_TOKEN', token);
        } catch (secretErr) {
          console.warn('Failed to auto-set OAUTH_TOKEN:', secretErr);
          // Don't fail the whole operation if secret setting fails
        }
      }
      
      // Copy setup workflow and run it if checkbox is checked
      if (autoCopyWorkflows) {
        try {
          // Small delay to ensure repo is fully created
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Copy the setup.yml workflow and trigger it with selected template
          // This workflow will create the project, copy workflows, and setup Pages
          await copySetupWorkflowAndRun(
            token,
            'friuns',
            'VibeGithub',
            createdRepo.owner.login,
            createdRepo.name,
            selectedTemplate
          );
        } catch (setupErr) {
          console.warn('Failed to copy and run setup workflow:', setupErr);
          // Don't fail the whole operation if setup workflow fails
        }
      }
      
      setIsCreateModalOpen(false);
      setNewRepo({ name: '', description: '', private: false, auto_init: true });
      setAutoSetOAuthToken(true);
      setAutoCopyWorkflows(true);
      
      // Manually add the new repo to the top of the list
      setRepos(prev => [createdRepo, ...prev]);
      
    } catch (err) {
      showError("Failed to create repository. Note: You need 'repo' scope token permissions.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (repo: Repository) => {
    setRepoToDelete(repo);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteRepo = async () => {
    if (!repoToDelete) return;

    setIsDeleting(true);
    try {
      await deleteRepository(token, repoToDelete.owner.login, repoToDelete.name);
      setIsDeleteModalOpen(false);
      setRepoToDelete(null);
      
      // Remove the repo from the list
      setRepos(prev => prev.filter(r => r.id !== repoToDelete.id));
      
    } catch (err) {
      showError("Failed to delete repository. Note: You need 'delete_repo' scope token permissions.");
    } finally {
      setIsDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setRepoToDelete(null);
  };

  const handlePinRepo = (repo: Repository) => {
    setPinnedRepoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(repo.id)) {
        newSet.delete(repo.id);
      } else {
        newSet.add(repo.id);
      }
      localStorage.setItem('pinnedRepos', JSON.stringify([...newSet]));
      return newSet;
    });
  };

  // Sort repos with pinned ones first
  const sortedRepos = React.useMemo(() => {
    return [...repos].sort((a, b) => {
      const aPinned = pinnedRepoIds.has(a.id);
      const bPinned = pinnedRepoIds.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [repos, pinnedRepoIds]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <img src={user.avatar_url} alt={user.login} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600" />
             <span className="font-semibold text-slate-900 dark:text-slate-100">{user.login}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={onLogout} icon={<LogOut size={16} />}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your Repositories</h2>
          <div className="flex gap-2 items-center">
            {isRefreshing && (
              <span className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>
            )}
            <Button variant="secondary" onClick={() => loadRepos(true)} icon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />} disabled={isRefreshing}>
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} icon={<Plus size={16} />}>
              New Repo
            </Button>
          </div>
        </div>

        {error && (
           <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg mb-6 border border-red-200 dark:border-red-800">
             {error}
           </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedRepos.map((repo) => (
              <RepoCard 
                key={repo.id} 
                repo={repo} 
                onClick={onRepoSelect} 
                onDelete={handleDeleteClick}
                onPin={handlePinRepo}
                isPinned={pinnedRepoIds.has(repo.id)}
                issues={repoIssues[repo.id]}
              />
            ))}
            {repos.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                    No repositories found.
                </div>
            )}
          </div>
        )}
      </main>

      {/* Create Repo Modal */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setIsCreateModalOpen(false)}
        >
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create Repository</h2>
                 <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>
              
              <form onSubmit={handleCreateRepo} className="p-6 space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repository Name</label>
                    <input 
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newRepo.name}
                      onChange={e => setNewRepo({...newRepo, name: e.target.value})}
                      placeholder="e.g., awesome-project"
                      required
                    />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span></label>
                    <textarea 
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                      value={newRepo.description}
                      onChange={e => setNewRepo({...newRepo, description: e.target.value})}
                      placeholder="What is this project about?"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Start with a template
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {VITE_TEMPLATES.map(template => (
                        <option key={template.value} value={template.value}>
                          {template.label} - {template.description}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {VITE_TEMPLATES.find(t => t.value === selectedTemplate)?.description}
                    </p>
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
                       checked={!newRepo.private}
                       onChange={() => setNewRepo({...newRepo, private: false})}
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
                       checked={newRepo.private}
                       onChange={() => setNewRepo({...newRepo, private: true})}
                       className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                     />
                   </label>
                 </div>
                 
                 <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox"
                      id="auto_init"
                      checked={newRepo.auto_init}
                      onChange={(e) => setNewRepo({...newRepo, auto_init: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="auto_init" className="text-sm text-slate-700 dark:text-slate-300">Initialize with a README</label>
                 </div>

                 {/* Auto-set OAUTH_TOKEN */}
                 <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={autoSetOAuthToken}
                        onChange={(e) => setAutoSetOAuthToken(e.target.checked)}
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

                 {/* Auto-copy Workflows */}
                 <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={autoCopyWorkflows}
                        onChange={(e) => setAutoCopyWorkflows(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        <FileCode size={16} className="text-blue-600 dark:text-blue-400" />
                        <div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Run automated repository setup</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Copies workflows from VibeGithub and configures GitHub Pages</p>
                        </div>
                      </div>
                    </label>
                 </div>
                 
                 <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                    <Button type="submit" variant="primary" isLoading={isCreating}>Create Repository</Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Delete Repo Modal */}
      {isDeleteModalOpen && repoToDelete && (
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
                   Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-100">{repoToDelete.owner.login}/{repoToDelete.name}</strong>?
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
                      isLoading={isDeleting}
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
