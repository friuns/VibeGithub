import { Component, For, Show, onMount, onCleanup } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { Repository, Issue, WorkflowFile, RepoSecret } from '../types';
import { fetchIssues, createIssue, fetchAllWorkflowFiles, fetchRepositorySecrets, setRepositorySecret, deleteRepositorySecret } from '../services/githubService';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { ArrowLeft, Plus, MessageCircle, AlertCircle, CheckCircle2, X, RefreshCw, FileCode, ChevronDown, ChevronUp, Key, Trash2, Eye, EyeOff, Shield } from 'lucide-solid';
import { cache } from '../store';

interface RepoDetailProps {
  token: string;
  repo: Repository;
  onBack: () => void;
  onIssueSelect: (issue: Issue) => void;
}

export const RepoDetail: Component<RepoDetailProps> = (props) => {
  const { toasts, dismissToast, showError } = useToast();
  const issuesCache = cache.repoIssues(props.repo.owner.login, props.repo.name);
  
  // Initialize from cache for instant display
  const cachedIssues = issuesCache.getOrDefault([]);
  const cachedWorkflows = cache.workflowFiles.getOrDefault([]);
  
  let bodyTextareaRef: HTMLTextAreaElement | undefined;
  
  const state = createMutable({
    issues: cachedIssues,
    loading: issuesCache.get() === null,
    isRefreshing: false,
    isModalOpen: false,
    creating: false,
    newTitle: '',
    newBody: '',
    workflowFiles: cachedWorkflows,
    loadingWorkflows: false,
    workflowsExpanded: false,
    secrets: [] as RepoSecret[],
    loadingSecrets: false,
    isSecretsModalOpen: false,
    newSecretName: '',
    newSecretValue: '',
    showSecretValue: false,
    savingSecret: false,
    deletingSecret: null as string | null,
    autoSetOAuthChecked: false,
  });

  // Filter out pull requests from the main list
  const issuesOnly = () => state.issues.filter(issue => !issue.pull_request);

  const loadIssues = async (isManualRefresh = false) => {
    const hasCachedData = state.issues.length > 0;
    
    if (!hasCachedData) {
      state.loading = true;
    } else if (isManualRefresh) {
      state.isRefreshing = true;
    }
    
    try {
      const data = await fetchIssues(props.token, props.repo.owner.login, props.repo.name);
      state.issues = data;
      issuesCache.set(data);
    } catch (err) {
      console.error(err);
    } finally {
      state.loading = false;
      state.isRefreshing = false;
    }
  };

  onMount(() => {
    loadIssues(false);
  });

  const handleCreateIssue = async (e: Event) => {
    e.preventDefault();
    if (!state.newTitle) return;

    state.creating = true;
    try {
      const createdIssue = await createIssue(props.token, props.repo.owner.login, props.repo.name, {
        title: state.newTitle,
        body: state.newBody,
        labels: ['jules'],
        assignees: ['copilot-swe-agent[bot]']
      });
      state.isModalOpen = false;
      state.newTitle = '';
      state.newBody = '';
      
      state.issues = [createdIssue, ...state.issues];
    } catch (err) {
      showError("Failed to create issue");
    } finally {
      state.creating = false;
    }
  };

  const loadWorkflowFiles = async () => {
    if (state.workflowFiles.length > 0) return;
    
    state.loadingWorkflows = true;
    try {
      const repos = cache.repos.getOrDefault([]);
      if (repos.length > 0) {
        const workflows = await fetchAllWorkflowFiles(props.token, repos);
        state.workflowFiles = workflows;
        cache.workflowFiles.set(workflows);
      }
    } catch (err) {
      console.error('Failed to load workflow files:', err);
    } finally {
      state.loadingWorkflows = false;
    }
  };

  const insertWorkflowReference = (workflow: WorkflowFile) => {
    const reference = `[${workflow.name}](${workflow.html_url}) (from \`${workflow.repoFullName}\`)`;
    
    if (bodyTextareaRef) {
      const textarea = bodyTextareaRef;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = state.newBody.substring(0, start);
      const after = state.newBody.substring(end);
      state.newBody = before + reference + after;
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + reference.length, start + reference.length);
      }, 0);
    } else {
      state.newBody = state.newBody + (state.newBody ? '\n\n' : '') + reference;
    }
  };

  // Close modals on Escape
  onMount(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        state.isModalOpen = false;
        state.isSecretsModalOpen = false;
      }
    };
    document.addEventListener('keydown', handleEscape);
    onCleanup(() => document.removeEventListener('keydown', handleEscape));
  });

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Header */}
      <header class="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <Button variant="ghost" onClick={props.onBack} icon={<ArrowLeft size={16} />}>
              Back
            </Button>
            <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">{props.repo.name}</h1>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="secondary" onClick={() => loadIssues(true)} icon={<RefreshCw size={16} class={state.isRefreshing ? 'animate-spin' : ''} />} disabled={state.isRefreshing}>
              Refresh
            </Button>
            <Button variant="primary" onClick={() => state.isModalOpen = true} icon={<Plus size={16} />}>
              New Issue
            </Button>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Show when={state.loading}>
          <div class="flex justify-center items-center h-64">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </Show>

        <Show when={!state.loading}>
          <div class="space-y-4">
            <For each={issuesOnly()}>
              {(issue) => (
                <div 
                  onClick={() => props.onIssueSelect(issue)}
                  class="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex items-start gap-3 flex-1">
                      <Show
                        when={issue.state === 'open'}
                        fallback={<CheckCircle2 size={20} class="text-purple-500 mt-1" />}
                      >
                        <AlertCircle size={20} class="text-green-500 mt-1" />
                      </Show>
                      <div class="flex-1">
                        <h3 class="font-semibold text-slate-900 dark:text-slate-100">{issue.title}</h3>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          #{issue.number} opened by {issue.user.login}
                        </p>
                      </div>
                    </div>
                    <Show when={issue.comments && issue.comments > 0}>
                      <div class="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <MessageCircle size={16} />
                        <span class="text-sm">{issue.comments}</span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
            <Show when={issuesOnly().length === 0}>
              <div class="text-center py-12 text-slate-500 dark:text-slate-400">
                No issues found. Create one to get started!
              </div>
            </Show>
          </div>
        </Show>
      </main>

      {/* Create Issue Modal */}
      <Show when={state.isModalOpen}>
        <div 
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => state.isModalOpen = false}
        >
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800">
              <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Create New Issue</h2>
              <button onClick={() => state.isModalOpen = false} class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateIssue} class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input 
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  value={state.newTitle}
                  onInput={(e) => state.newTitle = e.currentTarget.value}
                  placeholder="Issue title"
                  required
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea 
                  ref={bodyTextareaRef}
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 h-48 resize-y font-mono text-sm"
                  value={state.newBody}
                  onInput={(e) => state.newBody = e.currentTarget.value}
                  placeholder="Describe the issue..."
                />
              </div>

              <Show when={state.workflowFiles.length > 0 || state.loadingWorkflows}>
                <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <button
                    type="button"
                    onClick={() => {
                      state.workflowsExpanded = !state.workflowsExpanded;
                      if (!state.workflowsExpanded && state.workflowFiles.length === 0) {
                        loadWorkflowFiles();
                      }
                    }}
                    class="flex items-center justify-between w-full text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    <span class="flex items-center gap-2">
                      <FileCode size={16} />
                      Reference Workflow Files
                    </span>
                    <Show
                      when={state.workflowsExpanded}
                      fallback={<ChevronDown size={16} />}
                    >
                      <ChevronUp size={16} />
                    </Show>
                  </button>
                  
                  <Show when={state.workflowsExpanded}>
                    <div class="mt-3 space-y-2 max-h-48 overflow-y-auto">
                      <Show when={state.loadingWorkflows}>
                        <div class="text-center py-4 text-slate-500">Loading...</div>
                      </Show>
                      <For each={state.workflowFiles}>
                        {(workflow) => (
                          <button
                            type="button"
                            onClick={() => insertWorkflowReference(workflow)}
                            class="block w-full text-left px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded border border-slate-200 dark:border-slate-600"
                          >
                            <div class="font-mono text-xs text-slate-600 dark:text-slate-400">{workflow.repoFullName}</div>
                            <div class="font-medium text-slate-900 dark:text-slate-100">{workflow.name}</div>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
              
              <div class="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => state.isModalOpen = false}>Cancel</Button>
                <Button type="submit" variant="primary" isLoading={state.creating}>Create Issue</Button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
};
