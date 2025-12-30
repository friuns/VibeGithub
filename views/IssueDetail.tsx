import { Component, For, Show, onMount } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { Repository, Issue, Comment, WorkflowRun, Artifact, PullRequestDetails, Deployment, DeploymentStatus } from '../types';
import { fetchIssues, fetchComments, fetchWorkflowRuns, fetchArtifacts, fetchPullRequestDetails, fetchDeploymentsBySha, fetchDeploymentStatuses, mergePullRequest, createIssueComment } from '../services/githubService';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { Markdown } from '../components/Markdown';
import { ArrowLeft, MessageCircle, AlertCircle, CheckCircle2, GitPullRequest, PlayCircle, Package, Download, Rocket, RefreshCw } from 'lucide-solid';
import { cache, setIssueExpandedDataCache } from '../store';
import { CachedExpandedIssueData } from '../services/cacheService';

interface IssueDetailProps {
  token: string;
  repo: Repository;
  issue: Issue;
  onBack: () => void;
}

export const IssueDetail: Component<IssueDetailProps> = (props) => {
  const { toasts, dismissToast, showSuccess, showError, showInfo } = useToast();
  
  // Get cached data for instant display - Proxy automatically loads from cache
  const cachedData = cache.issueExpandedData(props.repo.owner.login, props.repo.name, props.issue.number);
  const cachedIssues = cache.repoIssues(props.repo.owner.login, props.repo.name);
  
  const state = createMutable({
    comments: (cachedData?.comments || []) as Comment[],
    workflowRuns: (cachedData?.workflowRuns || []) as WorkflowRun[],
    prDetails: new Map<number, PullRequestDetails>(
      cachedData?.prDetails ? Object.entries(cachedData.prDetails).map(([k, v]) => [Number(k), v]) : []
    ),
    deploymentsByPr: new Map<number, { deployment: Deployment; status: DeploymentStatus | null }[]>(
      cachedData?.deploymentsByPr ? Object.entries(cachedData.deploymentsByPr).map(([k, v]) => [Number(k), v]) : []
    ),
    artifacts: new Map<number, Artifact[]>(
      cachedData?.artifacts ? Object.entries(cachedData.artifacts).map(([k, v]) => [Number(k), v]) : []
    ),
    prComments: new Map<number, Comment[]>(
      cachedData?.prComments ? Object.entries(cachedData.prComments).map(([k, v]) => [Number(k), v]) : []
    ),
    loadingComments: !cachedData,
    loadingWorkflows: !cachedData,
    isRefreshing: false,
    mergingPrNumber: null as number | null,
    commentingPrNumber: null as number | null,
    prCommentTexts: new Map<number, string>(),
    issueCommentText: '',
    isPostingComment: false,
    allIssues: cachedIssues,
  });
  
  // Filter out pull requests
  const pullRequestsOnly = () => state.allIssues.filter(i => i.pull_request);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      state.isRefreshing = true;
    } else if (!cachedData) {
      state.loadingComments = true;
      state.loadingWorkflows = true;
    }
    
    try {
      // Load all issues to find PRs referencing this issue
      const allIssuesData = await fetchIssues(props.token, props.repo.owner.login, props.repo.name);
      state.allIssues = allIssuesData;
      
      // Load comments
      const commentsData = await fetchComments(props.token, props.repo.owner.login, props.repo.name, props.issue.number);
      state.comments = commentsData;
      
      // Load workflow runs
      const workflowData = await fetchWorkflowRuns(props.token, props.repo.owner.login, props.repo.name);
      state.workflowRuns = workflowData;
      
      // Cache the data using helper
      setIssueExpandedDataCache(props.repo.owner.login, props.repo.name, props.issue.number, {
        comments: state.comments,
        workflowRuns: state.workflowRuns,
        prDetails: Object.fromEntries(state.prDetails),
        deploymentsByPr: Object.fromEntries(state.deploymentsByPr),
        artifacts: Object.fromEntries(state.artifacts),
        prComments: Object.fromEntries(state.prComments),
      });
    } catch (err) {
      console.error(err);
    } finally {
      state.loadingComments = false;
      state.loadingWorkflows = false;
      state.isRefreshing = false;
    }
  };

  onMount(() => {
    loadData(false);
  });

  const handlePostIssueComment = async (e: Event) => {
    e.preventDefault();
    if (!state.issueCommentText.trim()) return;

    state.isPostingComment = true;
    try {
      const newComment = await createIssueComment(
        props.token,
        props.repo.owner.login,
        props.repo.name,
        props.issue.number,
        state.issueCommentText
      );
      state.comments = [...state.comments, newComment];
      state.issueCommentText = '';
      showSuccess('Comment posted!');
    } catch (err) {
      showError('Failed to post comment');
    } finally {
      state.isPostingComment = false;
    }
  };

  const handleMergePR = async (prNumber: number) => {
    state.mergingPrNumber = prNumber;
    try {
      await mergePullRequest(props.token, props.repo.owner.login, props.repo.name, prNumber);
      showSuccess(`PR #${prNumber} merged successfully!`);
      
      // Reload data
      await loadData(true);
    } catch (err) {
      showError('Failed to merge PR');
    } finally {
      state.mergingPrNumber = null;
    }
  };

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
            <div class="flex items-center gap-2">
              <Show
                when={props.issue.state === 'open'}
                fallback={<CheckCircle2 size={20} class="text-purple-500" />}
              >
                <AlertCircle size={20} class="text-green-500" />
              </Show>
              <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">{props.issue.title}</h1>
            </div>
          </div>
          <Button variant="secondary" onClick={() => loadData(true)} icon={<RefreshCw size={16} class={state.isRefreshing ? 'animate-spin' : ''} />} disabled={state.isRefreshing}>
            Refresh
          </Button>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Issue Body */}
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
            <span>#{props.issue.number}</span>
            <span>•</span>
            <span>opened by {props.issue.user.login}</span>
          </div>
          <Show when={props.issue.body} fallback={<p class="text-slate-500 dark:text-slate-400 italic">No description provided</p>}>
            <Markdown>{props.issue.body}</Markdown>
          </Show>
        </div>

        {/* Comments */}
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageCircle size={20} />
            Comments ({state.comments.length})
          </h2>
          
          <Show when={state.loadingComments}>
            <div class="bg-white dark:bg-slate-800 p-6 rounded-lg text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </Show>

          <Show when={!state.loadingComments}>
            <For each={state.comments}>
              {(comment) => (
                <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                  <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                    <img src={comment.user.avatar_url} alt={comment.user.login} class="w-6 h-6 rounded-full" />
                    <span class="font-medium">{comment.user.login}</span>
                    <span>•</span>
                    <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                  <Markdown>{comment.body}</Markdown>
                </div>
              )}
            </For>
          </Show>

          {/* Add Comment */}
          <form onSubmit={handlePostIssueComment} class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <textarea
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 h-32 resize-y"
              value={state.issueCommentText}
              onInput={(e) => state.issueCommentText = e.currentTarget.value}
              placeholder="Add a comment..."
            />
            <div class="mt-3 flex justify-end">
              <Button type="submit" variant="primary" isLoading={state.isPostingComment} disabled={!state.issueCommentText.trim()}>
                Post Comment
              </Button>
            </div>
          </form>
        </div>

        {/* Related PRs */}
        <Show when={pullRequestsOnly().length > 0}>
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <GitPullRequest size={20} />
              Related Pull Requests ({pullRequestsOnly().length})
            </h2>
            
            <For each={pullRequestsOnly()}>
              {(pr) => (
                <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h3 class="font-semibold text-slate-900 dark:text-slate-100">{pr.title}</h3>
                      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        #{pr.number} by {pr.user.login}
                      </p>
                    </div>
                    <Show when={pr.state === 'open'}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleMergePR(pr.number)}
                        isLoading={state.mergingPrNumber === pr.number}
                      >
                        Merge
                      </Button>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Workflow Runs */}
        <Show when={state.workflowRuns.length > 0}>
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PlayCircle size={20} />
              Workflow Runs ({state.workflowRuns.slice(0, 5).length})
            </h2>
            
            <For each={state.workflowRuns.slice(0, 5)}>
              {(run) => (
                <div class="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-medium text-slate-900 dark:text-slate-100">{run.name}</div>
                      <div class="text-sm text-slate-500 dark:text-slate-400">
                        {run.head_branch} • Run #{run.run_number}
                      </div>
                    </div>
                    <Show when={run.conclusion === 'success'}>
                      <CheckCircle2 size={20} class="text-green-500" />
                    </Show>
                    <Show when={run.conclusion === 'failure'}>
                      <AlertCircle size={20} class="text-red-500" />
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </main>
    </div>
  );
};
