import { createSignal, createEffect, onMount, For } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { fetchIssues, createIssue, fetchAllWorkflowFiles, fetchRepositorySecrets, setRepositorySecret, deleteRepositorySecret } from '../services/githubService';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { ArrowLeft, Plus, MessageCircle, AlertCircle, CheckCircle2, X, RefreshCw, FileCode, ChevronDown, ChevronUp, Key, Trash2, Eye, EyeOff, Shield } from 'lucide-solid';
import { getCached, setCache, CacheKeys } from '../services/cacheService';

export const RepoDetail = (props) => {
  const { toasts, dismissToast, showError } = useToast();
  const cacheKey = CacheKeys.repoIssues(props.repo.owner.login, props.repo.name);

  const state = createMutable({
    issues: getCached(cacheKey) || [],
    loading: !getCached(cacheKey),
    isRefreshing: false,
    isModalOpen: false,
    creating: false,
    newTitle: '',
    newBody: '',
    workflowFiles: getCached(CacheKeys.workflowFiles()) || [],
    loadingWorkflows: false,
    workflowsExpanded: false,
    secrets: [],
    loadingSecrets: false,
    isSecretsModalOpen: false,
    newSecretName: '',
    newSecretValue: '',
    showSecretValue: false,
    savingSecret: false,
    deletingSecret: null,
    autoSetOAuthChecked: false,
  });

  let bodyTextareaRef;

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
      setCache(cacheKey, data);
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

  const handleCreateIssue = async (e) => {
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
      state.issues.unshift(createdIssue);
    } catch (err) {
      showError("Failed to create issue");
    } finally {
      state.creating = false;
    }
  };

  const loadWorkflowFiles = async () => {
    const cachedWorkflows = getCached(CacheKeys.workflowFiles());
    if (cachedWorkflows && cachedWorkflows.length > 0) {
      state.workflowFiles = cachedWorkflows;
      return;
    }

    state.loadingWorkflows = true;
    try {
      const repos = getCached(CacheKeys.repos()) || [];
      if (repos.length > 0) {
        const workflows = await fetchAllWorkflowFiles(props.token, repos);
        state.workflowFiles = workflows;
        setCache(CacheKeys.workflowFiles(), workflows);
      }
    } catch (err) {
      console.error('Failed to load workflow files:', err);
    } finally {
      state.loadingWorkflows = false;
    }
  };

  createEffect(() => {
    if (state.isModalOpen && state.workflowFiles.length === 0) {
      loadWorkflowFiles();
    }
  });

  const insertWorkflowReference = (workflow) => {
    const reference = `[${workflow.name}](${workflow.html_url}) (from \`${workflow.repoFullName}\`)`;

    if (bodyTextareaRef) {
      const textarea = bodyTextareaRef;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = state.newBody.substring(0, start);
      const after = state.newBody.substring(end);
      const newText = before + reference + after;
      state.newBody = newText;

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + reference.length, start + reference.length);
      }, 0);
    } else {
      state.newBody = state.newBody + (state.newBody ? '\n' : '') + reference;
    }
  };

  const loadSecrets = async () => {
    state.loadingSecrets = true;
    try {
      const data = await fetchRepositorySecrets(props.token, props.repo.owner.login, props.repo.name);
      state.secrets = data;
    } catch (err) {
      console.error('Failed to load secrets:', err);
    } finally {
      state.loadingSecrets = false;
    }
  };

  createEffect(() => {
    if (state.isSecretsModalOpen) {
      loadSecrets();
    }
  });

  const handleAddSecret = async (e) => {
    e.preventDefault();
    if (!state.newSecretName || !state.newSecretValue) return;

    state.savingSecret = true;
    try {
      await setRepositorySecret(props.token, props.repo.owner.login, props.repo.name, state.newSecretName.toUpperCase(), state.newSecretValue);
      state.newSecretName = '';
      state.newSecretValue = '';
      state.showSecretValue = false;
      await loadSecrets();
    } catch (err) {
      showError('Failed to add secret. Make sure your token has "repo" scope.');
    } finally {
      state.savingSecret = false;
    }
  };

  const handleDeleteSecret = async (secretName) => {
    state.deletingSecret = secretName;
    try {
      await deleteRepositorySecret(props.token, props.repo.owner.login, props.repo.name, secretName);
      await loadSecrets();
    } catch (err) {
      showError('Failed to delete secret');
    } finally {
      state.deletingSecret = null;
    }
  };

  const handleAutoSetOAuthToken = async () => {
    state.autoSetOAuthChecked = true;
    state.savingSecret = true;
    try {
      await setRepositorySecret(props.token, props.repo.owner.login, props.repo.name, 'OAUTH_TOKEN', props.token);
      await loadSecrets();
    } catch (err) {
      showError('Failed to set OAUTH_TOKEN');
    } finally {
      state.savingSecret = false;
    }
  };

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div class="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={props.onBack} icon={<ArrowLeft size={18} />}>
            Back
          </Button>
          <div>
            <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">{props.repo.full_name}</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">Manage issues and view insights</p>
          </div>
          <div class="ml-auto flex items-center gap-2">
             <Show when={state.isRefreshing}>
               <span class="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>
             </Show>
             <Button variant="secondary" onClick={() => loadIssues(true)} icon={<RefreshCw size={16} class={state.isRefreshing ? 'animate-spin' : ''} />} disabled={state.isRefreshing}>
               Refresh
             </Button>
             <Button variant="secondary" onClick={() => state.isSecretsModalOpen = true} icon={<Key size={16} />}>
               Secrets
             </Button>
             <Button variant="primary" icon={<Plus size={18} />} onClick={() => state.isModalOpen = true}>
                New Issue
             </Button>
          </div>
        </div>
      </div>

      <main class="flex-grow max-w-7xl w-full mx-auto px-4 py-8">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MessageCircle size={20} />
            Issues
          </h2>

          <Show when={state.loading} fallback={
            <Show when={issuesOnly().length === 0} fallback={
              <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                <For each={issuesOnly()}>{(issue) =>
                  <div
                    class="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex gap-3 group cursor-pointer"
                    onClick={() => props.onIssueSelect(issue)}
                  >
                     <div class="mt-1 flex flex-col items-center gap-1">
                       <Show when={issue.state === 'open'} fallback={<CheckCircle2 class="text-slate-400 dark:text-slate-500" size={18} />}>
                         <AlertCircle class="text-green-600 dark:text-green-500" size={18} />
                       </Show>
                       <Show when={issue.comments && issue.comments > 0}>
                         <span class="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                           <MessageCircle size={10} />
                           {issue.comments}
                         </span>
                       </Show>
                     </div>
                     <div class="flex-grow min-w-0">
                       <div class="text-slate-900 dark:text-slate-100 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate block">
                         {issue.title}
                       </div>
                       <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-2 items-center">
                         <span>
                           #{issue.number} opened by {issue.user.login}
                         </span>
                         <For each={issue.labels}>{(label) =>
                           <span
                             class="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                             style={{
                               'background-color': `#${label.color}20`,
                               'border-color': `#${label.color}50`,
                               color: `#${label.color}`
                             }}
                           >
                             {label.name}
                           </span>
                         }</For>
                       </div>
                     </div>
                     <div class="flex items-center">
                       <span class="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 dark:text-slate-500">
                         <MessageCircle size={14} />
                       </span>
                     </div>
                  </div>
                }</For>
              </div>
            }>
               <div class="p-8 text-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  No issues found. Create one to get started!
               </div>
            </Show>
          }>
             <div class="space-y-4">
               <For each={[1,2,3]}>{(_) => <div class="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />}</For>
             </div>
          </Show>
        </div>

      </main>

      <Show when={state.isModalOpen}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Create New Issue</h2>
                 <button onClick={() => state.isModalOpen = false} class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>

              <form onSubmit={handleCreateIssue} class="p-6 space-y-4 flex-grow">
                 <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                    <input
                      class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={state.newTitle}
                      onInput={e => state.newTitle = e.target.value}
                      placeholder="e.g., Fix login bug on mobile"
                      required
                    />
                 </div>

                 <div>
                    <div class="flex justify-between items-center mb-1">
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    </div>
                    <textarea
                      ref={bodyTextareaRef}
                      class="w-full h-48 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      value={state.newBody}
                      onInput={e => state.newBody = e.target.value}
                      placeholder="Describe the issue..."
                    />
                    <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 text-right">Markdown supported</p>
                 </div>

                 <div class="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => state.workflowsExpanded = !state.workflowsExpanded}
                      class="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-colors"
                    >
                      <div class="flex items-center gap-2">
                        <FileCode size={16} class="text-amber-600 dark:text-amber-500" />
                        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Reference Workflow Files</span>
                        <Show when={state.workflowFiles.length > 0}>
                          <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                            {state.workflowFiles.length}
                          </span>
                        </Show>
                      </div>
                      <Show when={state.workflowsExpanded} fallback={<ChevronDown size={16} class="text-slate-400 dark:text-slate-500" />}>
                        <ChevronUp size={16} class="text-slate-400 dark:text-slate-500" />
                      </Show>
                    </button>

                    <Show when={state.workflowsExpanded}>
                      <div class="p-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 max-h-48 overflow-y-auto">
                        <Show when={state.loadingWorkflows} fallback={
                          <Show when={state.workflowFiles.length === 0} fallback={
                            <div class="space-y-1">
                              <For each={state.workflowFiles}>{(workflow) =>
                                <button
                                  type="button"
                                  onClick={() => insertWorkflowReference(workflow)}
                                  class="w-full flex items-center gap-2 p-2 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left group"
                                >
                                  <FileCode size={14} class="text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-500 flex-shrink-0" />
                                  <div class="flex-1 min-w-0">
                                    <span class="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-amber-800 dark:group-hover:text-amber-400 truncate block">
                                      {workflow.name}
                                    </span>
                                    <span class="text-xs text-slate-500 dark:text-slate-400 truncate block">
                                      {workflow.repoFullName}
                                    </span>
                                  </div>
                                  <span class="text-xs text-amber-600 dark:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    + Insert
                                  </span>
                                </button>
                              }</For>
                            </div>
                          }>
                            <p class="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                              No workflow files found in your repositories
                            </p>
                          </Show>
                        }>
                          <div class="flex items-center justify-center py-4">
                            <RefreshCw size={16} class="text-slate-400 dark:text-slate-500 animate-spin" />
                            <span class="ml-2 text-sm text-slate-500 dark:text-slate-400">Loading workflows...</span>
                          </div>
                        </Show>
                      </div>
                    </Show>
                 </div>

                 <div class="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => state.isModalOpen = false}>Cancel</Button>
                    <Button type="submit" variant="primary" isLoading={state.creating}>Submit Issue</Button>
                 </div>
              </form>
           </div>
        </div>
      </Show>

      <Show when={state.isSecretsModalOpen}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <div class="flex items-center gap-3">
                   <div class="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                     <Shield size={20} class="text-emerald-600 dark:text-emerald-400" />
                   </div>
                   <div>
                     <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Repository Secrets</h2>
                     <p class="text-sm text-slate-500 dark:text-slate-400">Manage secrets for GitHub Actions</p>
                   </div>
                 </div>
                 <button onClick={() => state.isSecretsModalOpen = false} class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                   <X size={24} />
                 </button>
              </div>

              <div class="p-6 space-y-6">
                 <div class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <Key size={20} class="text-blue-600 dark:text-blue-400" />
                        <div>
                          <p class="font-medium text-slate-800 dark:text-slate-100">Auto-set OAUTH_TOKEN</p>
                          <p class="text-xs text-slate-600 dark:text-slate-400">Use your current token as a secret for Actions</p>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAutoSetOAuthToken}
                        isLoading={state.savingSecret && state.autoSetOAuthChecked}
                        disabled={state.secrets.some(s => s.name === 'OAUTH_TOKEN')}
                      >
                        {state.secrets.some(s => s.name === 'OAUTH_TOKEN') ? 'Already Set' : 'Set Token'}
                      </Button>
                    </div>
                 </div>

                 <form onSubmit={handleAddSecret} class="space-y-4">
                    <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Add New Secret</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Secret Name</label>
                        <input
                          class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono uppercase"
                          value={state.newSecretName}
                          onInput={e => state.newSecretName = e.target.value.replace(/[^A-Za-z0-9_]/g, '_')}
                          placeholder="MY_SECRET_KEY"
                          required
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Secret Value</label>
                        <div class="relative">
                          <input
                            type={state.showSecretValue ? 'text' : 'password'}
                            class="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                            value={state.newSecretValue}
                            onInput={e => state.newSecretValue = e.target.value}
                            placeholder="••••••••"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => state.showSecretValue = !state.showSecretValue}
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            {state.showSecretValue ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="flex justify-end">
                      <Button type="submit" variant="primary" isLoading={state.savingSecret && !state.autoSetOAuthChecked} icon={<Plus size={16} />}>
                        Add Secret
                      </Button>
                    </div>
                 </form>

                 <div>
                    <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Existing Secrets</h3>
                    <Show when={state.loadingSecrets} fallback={
                      <Show when={state.secrets.length === 0} fallback={
                        <div class="space-y-2">
                          <For each={state.secrets}>{(secret) =>
                            <div
                              class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                            >
                              <div class="flex items-center gap-3">
                                <Key size={16} class="text-emerald-600 dark:text-emerald-400" />
                                <div>
                                  <span class="font-mono font-medium text-slate-800 dark:text-slate-100">{secret.name}</span>
                                  <span class="ml-2 text-xs text-slate-500 dark:text-slate-400">
                                    Updated {new Date(secret.updated_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteSecret(secret.name)}
                                disabled={state.deletingSecret === secret.name}
                                class="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                              >
                                {state.deletingSecret === secret.name ? (
                                  <RefreshCw size={16} class="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          }</For>
                        </div>
                      }>
                        <div class="text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                          No secrets configured yet
                        </div>
                      </Show>
                    }>
                      <div class="flex items-center justify-center py-8">
                        <RefreshCw size={20} class="text-slate-400 animate-spin" />
                        <span class="ml-2 text-slate-500 dark:text-slate-400">Loading secrets...</span>
                      </div>
                    </Show>
                 </div>

                 <div class="pt-4 flex justify-end">
                    <Button type="button" variant="ghost" onClick={() => state.isSecretsModalOpen = false}>Close</Button>
                 </div>
              </div>
           </div>
        </div>
      </Show>
    </div>
  );
};
