import React, { useEffect, useState, useRef } from 'react';
import { Repository, Issue, WorkflowFile, RepoSecret } from '../types';
import { fetchIssues, createIssue, fetchAllWorkflowFiles, fetchRepositorySecrets, setRepositorySecret, deleteRepositorySecret, createIssueComment } from '../services/githubService';
import { autoSetOAuthToken, setupRepositoryWorkflows } from '../services/repoSetupUtils';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { ArrowLeft, Plus, MessageCircle, AlertCircle, CheckCircle2, X, RefreshCw, FileCode, ChevronDown, ChevronUp, Key, Trash2, Eye, EyeOff, Shield, User, Check, Copy, Download } from 'lucide-react';
import { getCached, setCache, CacheKeys } from '../services/cacheService';

interface RepoDetailProps {
  token: string;
  repo: Repository;
  onBack: () => void;
  onIssueSelect: (issue: Issue) => void;
}

export const RepoDetail: React.FC<RepoDetailProps> = ({ token, repo, onBack, onIssueSelect }) => {
  const { toasts, dismissToast, showError } = useToast();
  const cacheKey = CacheKeys.repoIssues(repo.owner.login, repo.name);
  
  // Initialize from cache for instant display
  const [issues, setIssues] = useState<Issue[]>(() => {
    return getCached<Issue[]>(cacheKey) || [];
  });
  const [loading, setLoading] = useState(() => {
    // Only show loading if no cached data
    return !getCached<Issue[]>(cacheKey);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(() => {
    const saved = localStorage.getItem('issue-assignees');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return ['copilot-swe-agent[bot]'];
      }
    }
    return ['copilot-swe-agent[bot]'];
  });
  const [assigneesDropdownOpen, setAssigneesDropdownOpen] = useState(false);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Save assignees selection to localStorage
  useEffect(() => {
    localStorage.setItem('issue-assignees', JSON.stringify(selectedAssignees));
  }, [selectedAssignees]);
  
  // Hardcoded assignee options
  const availableAssignees = [
    { login: 'copilot-swe-agent[bot]', displayName: 'Copilot' },
  ];

  // Workflow Files State
  const [workflowFiles, setWorkflowFiles] = useState<WorkflowFile[]>(() => {
    return getCached<WorkflowFile[]>(CacheKeys.workflowFiles()) || [];
  });
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [workflowsExpanded, setWorkflowsExpanded] = useState(false);

  // Secrets State
  const [secrets, setSecrets] = useState<RepoSecret[]>([]);
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  const [isSecretsModalOpen, setIsSecretsModalOpen] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [showSecretValue, setShowSecretValue] = useState(false);
  const [savingSecret, setSavingSecret] = useState(false);
  const [deletingSecret, setDeletingSecret] = useState<string | null>(null);
  const [autoSetOAuthChecked, setAutoSetOAuthChecked] = useState(false);

  // Reference Workflows State
  const [copyingAllWorkflows, setCopyingAllWorkflows] = useState(false);

  // Filter out pull requests from the main list
  const issuesOnly = issues.filter(issue => !issue.pull_request);

  const loadIssues = React.useCallback(async (isManualRefresh = false) => {
    const hasCachedData = issues.length > 0;
    
    // Show full loading only on first load with no cache
    if (!hasCachedData) {
      setLoading(true);
    } else if (isManualRefresh) {
      setIsRefreshing(true);
    }
    
    try {
      const data = await fetchIssues(token, repo.owner.login, repo.name);
      setIssues(data);
      // Cache the issues for instant display on next visit
      setCache(cacheKey, data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token, repo, cacheKey, issues.length]);

  useEffect(() => {
    // Always fetch fresh data on mount, but show cached immediately
    loadIssues(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    setCreating(true);
    try {
      const createdIssue = await createIssue(token, repo.owner.login, repo.name, {
        title: newTitle,
        body: newBody,
        labels: ['jules'],
        assignees: selectedAssignees
      });

      // Automatically add the "/opencode implement" comment to trigger copilot-swe-agent
      try {
        await createIssueComment(token, repo.owner.login, repo.name, createdIssue.number, '/opencode implement');
      } catch (commentErr) {
        console.error('Failed to add initial comment:', commentErr);
        // Don't fail the entire operation if comment fails
      }

      setIsModalOpen(false);
      setNewTitle('');
      setNewBody('');

      // Manually add the new issue to the top of the list
      setIssues(prev => [createdIssue, ...prev]);

    } catch (err) {
      showError("Failed to create issue");
    } finally {
      setCreating(false);
    }
  };

  const loadWorkflowFiles = React.useCallback(async () => {
    const cachedWorkflows = getCached<WorkflowFile[]>(CacheKeys.workflowFiles());
    if (cachedWorkflows && cachedWorkflows.length > 0) {
      setWorkflowFiles(cachedWorkflows);
      return;
    }
    
    setLoadingWorkflows(true);
    try {
      // Fetch repos first if needed
      const repos = getCached<Repository[]>(CacheKeys.repos()) || [];
      if (repos.length > 0) {
        const workflows = await fetchAllWorkflowFiles(token, repos);
        setWorkflowFiles(workflows);
        setCache(CacheKeys.workflowFiles(), workflows);
      }
    } catch (err) {
      console.error('Failed to load workflow files:', err);
    } finally {
      setLoadingWorkflows(false);
    }
  }, [token]);

  // Load workflow files when modal opens
  useEffect(() => {
    if (isModalOpen && workflowFiles.length === 0) {
      loadWorkflowFiles();
    }
  }, [isModalOpen, workflowFiles.length, loadWorkflowFiles]);

  const insertWorkflowReference = (workflow: WorkflowFile) => {
    const reference = `[${workflow.name}](${workflow.html_url}) (from \`${workflow.repoFullName}\`)`;
    
    if (bodyTextareaRef.current) {
      const textarea = bodyTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = newBody.substring(0, start);
      const after = newBody.substring(end);
      const newText = before + reference + after;
      setNewBody(newText);
      
      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + reference.length, start + reference.length);
      }, 0);
    } else {
      // Fallback: append to the end
      setNewBody(prev => prev + (prev ? '\n' : '') + reference);
    }
  };

  // Secrets functions
  const loadSecrets = React.useCallback(async () => {
    setLoadingSecrets(true);
    try {
      const data = await fetchRepositorySecrets(token, repo.owner.login, repo.name);
      setSecrets(data);
    } catch (err) {
      console.error('Failed to load secrets:', err);
    } finally {
      setLoadingSecrets(false);
    }
  }, [token, repo]);

  // Load secrets when modal opens
  useEffect(() => {
    if (isSecretsModalOpen) {
      loadSecrets();
    }
  }, [isSecretsModalOpen, loadSecrets]);

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretName || !newSecretValue) return;

    setSavingSecret(true);
    try {
      await setRepositorySecret(token, repo.owner.login, repo.name, newSecretName.toUpperCase(), newSecretValue);
      setNewSecretName('');
      setNewSecretValue('');
      setShowSecretValue(false);
      await loadSecrets();
    } catch (err) {
      showError('Failed to add secret. Make sure your token has "repo" scope.');
    } finally {
      setSavingSecret(false);
    }
  };

  const handleDeleteSecret = async (secretName: string) => {
    setDeletingSecret(secretName);
    try {
      await deleteRepositorySecret(token, repo.owner.login, repo.name, secretName);
      await loadSecrets();
    } catch (err) {
      showError('Failed to delete secret');
    } finally {
      setDeletingSecret(null);
    }
  };

  const handleAutoSetOAuthToken = async () => {
    setAutoSetOAuthChecked(true);
    setSavingSecret(true);
    try {
      await autoSetOAuthToken(token, repo.owner.login, repo.name);
      await loadSecrets();
    } catch (err) {
      showError('Failed to set OAUTH_TOKEN');
    } finally {
      setSavingSecret(false);
    }
  };

  // Run automated repository setup
  const handleCopyAllWorkflows = async () => {
    setCopyingAllWorkflows(true);
    
    try {
      await setupRepositoryWorkflows(token, repo.owner.login, repo.name);
      
      showError('Setup workflow started! It will copy all workflows and configure GitHub Pages.');
      
      // Refresh workflows after a delay to show the new setup.yml
      setTimeout(() => {
        loadWorkflowFiles();
      }, 3000);
    } catch (err: any) {
      console.error('Failed to start setup workflow:', err);
      showError(err?.message || 'Failed to start setup workflow. Ensure your token has "repo" and "workflow" scopes.');
    } finally {
      setCopyingAllWorkflows(false);
    }
  };



  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={18} />}>
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors" onClick={() => window.open(repo.html_url, '_blank')}>{repo.full_name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors hidden sm:block" onClick={() => window.open(repo.html_url, '_blank')}>Manage issues and view insights</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
             {isRefreshing && (
               <span className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>
             )}
             <Button variant="secondary" onClick={() => loadIssues(true)} icon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />} disabled={isRefreshing}>
               Refresh
             </Button>
             <Button variant="secondary" onClick={() => setIsSecretsModalOpen(true)} icon={<Key size={16} />}>
               Secrets
             </Button>
             <Button variant="primary" icon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>
                New Issue
             </Button>
          </div>
        </div>
      </div>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8">
        {/* Issue List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MessageCircle size={20} />
            Issues
          </h2>
          
          {loading ? (
             <div className="space-y-4">
               {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />)}
             </div>
          ) : issuesOnly.length === 0 ? (
             <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                No issues found. Create one to get started!
             </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
              {issuesOnly.map(issue => (
                <div 
                  key={issue.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex gap-3 group cursor-pointer" 
                  onClick={() => onIssueSelect(issue)}
                >
                   <div className="mt-1 flex flex-col items-center gap-1">
                     {issue.state === 'open' ? (
                       <AlertCircle className="text-green-600 dark:text-green-500" size={18} />
                     ) : (
                       <CheckCircle2 className="text-slate-400 dark:text-slate-500" size={18} />
                     )}
                     {issue.comments && issue.comments > 0 && (
                       <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                         <MessageCircle size={10} />
                         {issue.comments}
                       </span>
                     )}
                   </div>
                   <div className="flex-grow min-w-0">
                     <div className="text-slate-900 dark:text-slate-100 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate block">
                       {issue.title}
                     </div>
                     <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-2 items-center">
                       <span>
                         #{issue.number} opened by {issue.user.login}
                       </span>
                       {issue.labels.map(label => (
                         <span
                           key={label.id}
                           className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                           style={{
                             backgroundColor: `#${label.color}20`,
                             borderColor: `#${label.color}50`,
                             color: `#${label.color}`
                           }}
                         >
                           {label.name}
                         </span>
                       ))}
                     </div>
                   </div>
                   <div className="flex items-center">
                     <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 dark:text-slate-500">
                       <MessageCircle size={14} />
                     </span>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Create Issue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create New Issue</h2>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>

              <form onSubmit={handleCreateIssue} className="p-6 space-y-4 flex-grow">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                    <input
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="e.g., Fix login bug on mobile"
                      required
                    />
                 </div>

                 <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    </div>
                    <textarea
                      ref={bodyTextareaRef}
                      className="w-full h-48 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      value={newBody}
                      onChange={e => setNewBody(e.target.value)}
                      placeholder="Describe the issue..."
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-right">Markdown supported</p>
                 </div>

                 {/* Assignees Selection */}
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assignees</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setAssigneesDropdownOpen(!assigneesDropdownOpen)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedAssignees.length === 0 ? (
                            <span className="text-slate-400 dark:text-slate-500">Select assignees...</span>
                          ) : (
                            selectedAssignees.map(login => {
                              const assignee = availableAssignees.find(a => a.login === login);
                              return (
                                <span
                                  key={login}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                                >
                                  <User size={12} />
                                  {assignee?.displayName || login}
                                </span>
                              );
                            })
                          )}
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${assigneesDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {assigneesDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {availableAssignees.map(assignee => {
                            const isSelected = selectedAssignees.includes(assignee.login);
                            return (
                              <button
                                key={assignee.login}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedAssignees(prev => prev.filter(a => a !== assignee.login));
                                  } else {
                                    setSelectedAssignees(prev => [...prev, assignee.login]);
                                  }
                                }}
                                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-left"
                              >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-500'}`}>
                                  {isSelected && <Check size={12} className="text-white" />}
                                </div>
                                <User size={14} className="text-slate-400" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{assignee.displayName}</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">({assignee.login})</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                 </div>

                 {/* Workflow Files Reference Section */}
                 <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setWorkflowsExpanded(!workflowsExpanded)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode size={16} className="text-amber-600 dark:text-amber-500" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Reference Workflow Files</span>
                        {workflowFiles.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                            {workflowFiles.length}
                          </span>
                        )}
                      </div>
                      {workflowsExpanded ? (
                        <ChevronUp size={16} className="text-slate-400 dark:text-slate-500" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
                      )}
                    </button>
                    
                    {workflowsExpanded && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 max-h-48 overflow-y-auto">
                        {loadingWorkflows ? (
                          <div className="flex items-center justify-center py-4">
                            <RefreshCw size={16} className="text-slate-400 dark:text-slate-500 animate-spin" />
                            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Loading workflows...</span>
                          </div>
                        ) : workflowFiles.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                            No workflow files found in your repositories
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {workflowFiles.map((workflow) => (
                              <button
                                key={`${workflow.repoFullName}/${workflow.path}`}
                                type="button"
                                onClick={() => insertWorkflowReference(workflow)}
                                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left group"
                              >
                                <FileCode size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-amber-800 dark:group-hover:text-amber-400 truncate block">
                                    {workflow.name}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                                    {workflow.repoFullName}
                                  </span>
                                </div>
                                <span className="text-xs text-amber-600 dark:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  + Insert
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                 </div>

                 <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" variant="primary" isLoading={creating}>Submit Issue</Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Secrets Modal */}
      {isSecretsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                     <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />
                   </div>
                   <div>
                     <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Repository Secrets</h2>
                     <p className="text-sm text-slate-500 dark:text-slate-400">Manage secrets for GitHub Actions</p>
                   </div>
                 </div>
                 <button onClick={() => setIsSecretsModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>

              <div className="p-6 space-y-6">
                 {/* Quick Action: Auto-set OAUTH_TOKEN */}
                 <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Key size={20} className="text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">Auto-set OAUTH_TOKEN</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Use your current token as a secret for Actions</p>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAutoSetOAuthToken}
                        isLoading={savingSecret && autoSetOAuthChecked}
                        disabled={secrets.some(s => s.name === 'OAUTH_TOKEN')}
                      >
                        {secrets.some(s => s.name === 'OAUTH_TOKEN') ? 'Already Set' : 'Set Token'}
                      </Button>
                    </div>
                 </div>

                 {/* Add New Secret Form */}
                 <form onSubmit={handleAddSecret} className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Add New Secret</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Secret Name</label>
                        <input
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono uppercase"
                          value={newSecretName}
                          onChange={e => setNewSecretName(e.target.value.replace(/[^A-Za-z0-9_]/g, '_'))}
                          placeholder="MY_SECRET_KEY"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Secret Value</label>
                        <div className="relative">
                          <input
                            type={showSecretValue ? 'text' : 'password'}
                            className="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                            value={newSecretValue}
                            onChange={e => setNewSecretValue(e.target.value)}
                            placeholder="••••••••"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecretValue(!showSecretValue)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            {showSecretValue ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" variant="primary" isLoading={savingSecret && !autoSetOAuthChecked} icon={<Plus size={16} />}>
                        Add Secret
                      </Button>
                    </div>
                 </form>

                 {/* Existing Secrets List */}
                 <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Existing Secrets</h3>
                    {loadingSecrets ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw size={20} className="text-slate-400 animate-spin" />
                        <span className="ml-2 text-slate-500 dark:text-slate-400">Loading secrets...</span>
                      </div>
                    ) : secrets.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                        No secrets configured yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {secrets.map(secret => (
                          <div
                            key={secret.name}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                          >
                            <div className="flex items-center gap-3">
                              <Key size={16} className="text-emerald-600 dark:text-emerald-400" />
                              <div>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-100">{secret.name}</span>
                                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                                  Updated {new Date(secret.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteSecret(secret.name)}
                              disabled={deletingSecret === secret.name}
                              className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                            >
                              {deletingSecret === secret.name ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>

                 {/* Copy Reference Workflows Section */}
                 <div className="border-t border-slate-200 dark:border-slate-600 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Download size={18} className="text-blue-600 dark:text-blue-400" />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        Automated Repository Setup
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Run the setup workflow to copy all workflows from the reference repository and configure GitHub Pages in one automated process.
                    </p>
                    
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCopyAllWorkflows}
                      isLoading={copyingAllWorkflows}
                      icon={<FileCode size={14} />}
                    >
                      Run Automated Setup
                    </Button>
                 </div>

                 <div className="pt-4 flex justify-end">
                    <Button type="button" variant="ghost" onClick={() => setIsSecretsModalOpen(false)}>Close</Button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
