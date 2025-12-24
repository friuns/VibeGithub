import { createSignal, createEffect, onMount, For } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { fetchIssues, fetchComments, fetchWorkflowRuns, fetchArtifacts, fetchPullRequestDetails, fetchDeploymentsBySha, fetchDeploymentStatuses, mergePullRequest, createIssueComment } from '../services/githubService';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { Markdown } from '../components/Markdown';
import { ArrowLeft, MessageCircle, AlertCircle, CheckCircle2, GitPullRequest, PlayCircle, Package, Download, Rocket, RefreshCw } from 'lucide-solid';
import { getCached, setCache, CacheKeys } from '../services/cacheService';

export const IssueDetail = (props) => {
  const { toasts, dismissToast, showSuccess, showError, showInfo } = useToast();

  const issuesCacheKey = CacheKeys.repoIssues(props.repo.owner.login, props.repo.name);
  const expandedCacheKey = CacheKeys.issueExpandedData(props.repo.owner.login, props.repo.name, props.issue.number);

  const cachedData = getCached(expandedCacheKey);

  const state = createMutable({
    comments: cachedData?.comments || [],
    workflowRuns: cachedData?.workflowRuns || [],
    prDetails: cachedData?.prDetails ? new Map(Object.entries(cachedData.prDetails).map(([k, v]) => [Number(k), v])) : new Map(),
    deploymentsByPr: cachedData?.deploymentsByPr ? new Map(Object.entries(cachedData.deploymentsByPr).map(([k, v]) => [Number(k), v])) : new Map(),
    artifacts: cachedData?.artifacts ? new Map(Object.entries(cachedData.artifacts).map(([k, v]) => [Number(k), v])) : new Map(),
    prComments: cachedData?.prComments ? new Map(Object.entries(cachedData.prComments).map(([k, v]) => [Number(k), v])) : new Map(),
    loadingComments: !cachedData,
    loadingWorkflows: !cachedData,
    isRefreshing: false,
    mergingPrNumber: null,
    commentingPrNumber: null,
    prCommentTexts: new Map(),
    issueCommentText: '',
    isPostingComment: false,
    allIssues: getCached(issuesCacheKey) || [],
  });

  const pullRequestsOnly = () => state.allIssues.filter(i => i.pull_request);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      state.isRefreshing = true;
    } else if (!cachedData) {
      state.loadingComments = true;
      state.loadingWorkflows = true;
    }

    try {
      const [issuesList, issueComments, runs] = await Promise.all([
        fetchIssues(props.token, props.repo.owner.login, props.repo.name),
        fetchComments(props.token, props.repo.owner.login, props.repo.name, props.issue.number),
        fetchWorkflowRuns(props.token, props.repo.owner.login, props.repo.name).catch(() => [])
      ]);

      state.allIssues = issuesList;
      setCache(issuesCacheKey, issuesList);
      state.comments = issueComments;
      state.workflowRuns = runs;

      const freshPullRequestsOnly = issuesList.filter(i => i.pull_request);
      const relatedPRs = freshPullRequestsOnly.filter(pr => {
        const issueRef = `#${props.issue.number}`;
        const titleMatch = pr.title?.toLowerCase().includes(issueRef.toLowerCase());
        const bodyMatch = pr.body?.toLowerCase().includes(issueRef.toLowerCase());
        return titleMatch || bodyMatch;
      });

      const prDetailPromises = relatedPRs.map(async (pr) => {
        try {
          const details = await fetchPullRequestDetails(props.token, props.repo.owner.login, props.repo.name, pr.number);
          return { prNumber: pr.number, details };
        } catch {
          return { prNumber: pr.number, details: null };
        }
      });

      const prDetailResults = await Promise.all(prDetailPromises);
      const prDetailMap = new Map();
      prDetailResults.forEach(({ prNumber, details }) => {
        if (details) prDetailMap.set(prNumber, details);
      });
      state.prDetails = prDetailMap;

      const prCommentPromises = relatedPRs.map(async (pr) => {
        try {
          const prCommentsList = await fetchComments(props.token, props.repo.owner.login, props.repo.name, pr.number);
          return { prNumber: pr.number, comments: prCommentsList };
        } catch {
          return { prNumber: pr.number, comments: [] };
        }
      });

      const prCommentResults = await Promise.all(prCommentPromises);
      const prCommentsMap = new Map();
      prCommentResults.forEach(({ prNumber, comments: prCommentsList }) => {
        prCommentsMap.set(prNumber, prCommentsList);
      });
      state.prComments = prCommentsMap;

      const relatedShas = new Set();
      prDetailMap.forEach((details) => {
        if (details.head?.sha) relatedShas.add(details.head.sha);
      });

      const deploymentsPromises = Array.from(prDetailMap.entries()).map(async ([prNumber, details]) => {
        try {
          const deployments = await fetchDeploymentsBySha(props.token, props.repo.owner.login, props.repo.name, details.head.sha);
          const latest = deployments[0];
          if (!latest) return { prNumber, items: [] };
          const statuses = await fetchDeploymentStatuses(props.token, props.repo.owner.login, props.repo.name, latest.id).catch(() => []);
          const latestStatus = statuses[0] || null;
          return { prNumber, items: [{ deployment: latest, status: latestStatus }] };
        } catch {
          return { prNumber, items: [] };
        }
      });

      const deploymentsResults = await Promise.all(deploymentsPromises);
      const deploymentsMap = new Map();
      deploymentsResults.forEach(({ prNumber, items }) => {
        deploymentsMap.set(prNumber, items);
      });
      state.deploymentsByPr = deploymentsMap;

      const relatedRunsForArtifacts = runs
        .filter(r => r.head_sha && relatedShas.has(r.head_sha))
        .slice(0, 10);

      const artifactPromises = relatedRunsForArtifacts.map(async (run) => {
        try {
          const runArtifacts = await fetchArtifacts(props.token, props.repo.owner.login, props.repo.name, run.id);
          return { runId: run.id, artifacts: runArtifacts };
        } catch {
          return { runId: run.id, artifacts: [] };
        }
      });

      const artifactResults = await Promise.all(artifactPromises);
      const artifactMap = new Map();
      artifactResults.forEach(({ runId, artifacts: runArtifacts }) => {
        artifactMap.set(runId, runArtifacts);
      });
      state.artifacts = artifactMap;

      const dataToCache = {
        comments: issueComments,
        workflowRuns: runs,
        prDetails: Object.fromEntries(prDetailMap),
        deploymentsByPr: Object.fromEntries(deploymentsMap),
        artifacts: Object.fromEntries(artifactMap),
        prComments: Object.fromEntries(prCommentsMap),
      };
      setCache(expandedCacheKey, dataToCache);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      state.comments = [];
      state.workflowRuns = [];
    } finally {
      state.loadingComments = false;
      state.loadingWorkflows = false;
      state.isRefreshing = false;
    }
  };

  onMount(() => {
    loadData(false);
  });

  const handleMergePR = async (prNumber) => {
    state.mergingPrNumber = prNumber;
    try {
      await mergePullRequest(props.token, props.repo.owner.login, props.repo.name, prNumber, 'squash');
      const details = await fetchPullRequestDetails(props.token, props.repo.owner.login, props.repo.name, prNumber);
      state.prDetails.set(prNumber, details);
      showSuccess('Pull request merged successfully');
    } catch (err) {
      showError(err.message || 'Failed to merge pull request');
    } finally {
      state.mergingPrNumber = null;
    }
  };

  const handleCommentJulesOnPR = async (prNumber) => {
    const userComment = state.prCommentTexts.get(prNumber) || '';
    if (!userComment.trim()) {
      showInfo('Please enter a comment');
      return;
    }

    state.commentingPrNumber = prNumber;
    try {
      const body = `${userComment.trim()} @jules`;
      await createIssueComment(props.token, props.repo.owner.login, props.repo.name, prNumber, body);
      showSuccess('Comment posted');
      state.prCommentTexts.delete(prNumber);
    } catch (err) {
      showError(err.message || 'Failed to post comment');
    } finally {
      state.commentingPrNumber = null;
    }
  };

  const handlePostIssueComment = async () => {
    if (!state.issueCommentText.trim()) {
      showInfo('Please enter a comment');
      return;
    }

    state.isPostingComment = true;
    try {
      const newComment = await createIssueComment(props.token, props.repo.owner.login, props.repo.name, props.issue.number, state.issueCommentText.trim());
      state.comments.push(newComment);
      state.issueCommentText = '';
      showSuccess('Comment posted successfully');
    } catch (err) {
      showError(err.message || 'Failed to post comment');
    } finally {
      state.isPostingComment = false;
    }
  };

  const getRelatedPullRequests = () => {
    return pullRequestsOnly().filter(pr => {
      const issueRef = `#${props.issue.number}`;
      const titleMatch = pr.title?.toLowerCase().includes(issueRef.toLowerCase());
      const bodyMatch = pr.body?.toLowerCase().includes(issueRef.toLowerCase());
      return titleMatch || bodyMatch;
    });
  };

  const getRelatedWorkflowRuns = () => {
    const relatedPRs = getRelatedPullRequests();
    if (relatedPRs.length === 0) return [];

    const prShas = new Set();
    relatedPRs.forEach(pr => {
      const details = state.prDetails.get(pr.number);
      if (details) {
        if (details.head?.sha) prShas.add(details.head.sha);
      }
    });

    return state.workflowRuns.filter(run => run.head_sha && prShas.has(run.head_sha));
  };

  const getDeployBadge = (statusState) => {
    switch (statusState) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400';
      case 'failure':
      case 'error':
        return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400';
      case 'in_progress':
      case 'queued':
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  const relatedPRs = () => getRelatedPullRequests();
  const relatedRuns = () => getRelatedWorkflowRuns();
  const deploymentItems = () => {
    const prNumbers = relatedPRs().map(pr => pr.number);
    return prNumbers.flatMap((n) => (state.deploymentsByPr.get(n) || []).map((it) => ({ prNumber: n, ...it })));
  };

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div class="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={props.onBack} icon={<ArrowLeft size={18} />}>
            Back
          </Button>
          <div class="flex-grow min-w-0">
            <div class="flex items-center gap-2">
              <Show when={props.issue.state === 'open'} fallback={<CheckCircle2 class="text-slate-400 dark:text-slate-500 flex-shrink-0" size={18} />}>
                <AlertCircle class="text-green-600 dark:text-green-500 flex-shrink-0" size={18} />
              </Show>
              <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{props.issue.title}</h1>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400">{props.repo.full_name} · Issue #{props.issue.number}</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <Show when={state.isRefreshing}>
              <span class="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>
            </Show>
            <Button variant="secondary" onClick={() => loadData(true)} icon={<RefreshCw size={16} class={state.isRefreshing ? 'animate-spin' : ''} />} disabled={state.isRefreshing}>
              Refresh
            </Button>
            <a
              href={props.issue.html_url}
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      <main class="flex-grow max-w-7xl w-full mx-auto px-4 py-8 space-y-8">
        <Show when={props.issue.body}>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <MessageCircle size={16} />
              Description
            </h2>
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <Markdown content={props.issue.body} />
            </div>
          </div>
        </Show>

        <Show when={props.issue.labels.length > 0}>
          <div class="flex flex-wrap gap-2">
            <For each={props.issue.labels}>{(label) =>
              <span
                class="px-3 py-1 rounded-full text-xs font-medium border"
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
        </Show>

        <Show when={!state.loadingComments && relatedPRs().length > 0}>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <GitPullRequest size={16} />
              Related Pull Requests ({relatedPRs().length})
            </h3>
            <div class="space-y-6">
              <For each={relatedPRs()}>{(pr) =>
                <div class="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                  <div class="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/30">
                    <GitPullRequest
                      class={pr.state === 'open' ? "text-green-600 dark:text-green-500" : "text-purple-600 dark:text-purple-500"}
                      size={18}
                    />
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <a
                          href={pr.html_url}
                          target="_blank"
                          rel="noreferrer"
                          class="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {pr.title}
                        </a>
                        <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          pr.state === 'open'
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                            : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400'
                        }`}>
                          {pr.state}
                        </span>
                      </div>
                      <div class="text-xs text-slate-600 dark:text-slate-400">
                        #{pr.number} opened by {pr.user.login}
                      </div>
                      <Show when={pr.body}>
                        <div class="mt-2 line-clamp-3 overflow-hidden">
                          <Markdown content={pr.body} />
                        </div>
                      </Show>
                      <div class="mt-3 space-y-2">
                        <div class="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={state.mergingPrNumber === pr.number}
                            disabled={state.mergingPrNumber !== null || pr.state !== 'open'}
                            onClick={() => handleMergePR(pr.number)}
                          >
                            Merge
                          </Button>
                        </div>
                        <div class="flex gap-2">
                          <input
                            type="text"
                            placeholder="Write your comment..."
                            value={state.prCommentTexts.get(pr.number) || ''}
                            onInput={(e) => {
                              state.prCommentTexts.set(pr.number, e.target.value);
                            }}
                            class="flex-grow px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={state.commentingPrNumber === pr.number}
                            disabled={state.commentingPrNumber !== null}
                            onClick={() => handleCommentJulesOnPR(pr.number)}
                          >
                            Send @jules
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Show when={state.prComments.get(pr.number)?.length > 0}>
                    <div class="border-t border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 p-4">
                      <div class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                        <MessageCircle size={12} />
                        {state.prComments.get(pr.number).length} comment{state.prComments.get(pr.number).length !== 1 ? 's' : ''}
                      </div>
                      <div class="space-y-3">
                        <For each={state.prComments.get(pr.number)}>{(comment) =>
                          <div class="flex gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                            <img
                              src={comment.user.avatar_url}
                              alt={comment.user.login}
                              class="w-7 h-7 rounded-full flex-shrink-0"
                            />
                            <div class="flex-grow min-w-0">
                              <div class="flex items-center gap-2 mb-1">
                                <span class="font-medium text-slate-900 dark:text-slate-100 text-sm">{comment.user.login}</span>
                                <span class="text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div class="text-sm">
                                <Markdown content={comment.body} />
                              </div>
                            </div>
                          </div>
                        }</For>
                      </div>
                    </div>
                  </Show>
                </div>
              }</For>
            </div>
          </div>
        </Show>

        <Show when={!state.loadingWorkflows && deploymentItems().length > 0}>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Rocket size={16} />
              Related Deployments ({deploymentItems().length})
            </h3>
            <div class="space-y-3">
              <For each={deploymentItems()}>{(item) =>
                <div class="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg">
                  <div class="flex items-start gap-3">
                    <Rocket class="text-slate-500 dark:text-slate-400" size={18} />
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.deployment.environment}
                        </div>
                        <Show when={item.status}>
                          <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${getDeployBadge(item.status.state)}`}>
                            {item.status.state}
                          </span>
                        </Show>
                      </div>
                      <div class="text-xs text-slate-600 dark:text-slate-400">
                        PR #{item.prNumber} • {new Date(item.deployment.created_at).toLocaleString()}
                      </div>
                      <Show when={item.status?.environment_url || item.status?.log_url}>
                        <div class="text-xs mt-2 flex gap-3">
                          <Show when={item.status?.environment_url}>
                            <a
                              href={item.status.environment_url}
                              target="_blank"
                              rel="noreferrer"
                              class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              Open environment
                            </a>
                          </Show>
                          <Show when={item.status?.log_url}>
                            <a
                              href={item.status.log_url}
                              target="_blank"
                              rel="noreferrer"
                              class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              View logs
                            </a>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              }</For>
            </div>
          </div>
        </Show>

        <Show when={!state.loadingWorkflows && relatedRuns().length > 0}>
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <PlayCircle size={16} />
              Related Actions ({relatedRuns().length})
            </h3>
            <div class="space-y-3">
              <For each={relatedRuns().slice(0, 5)}>{(run) =>
                <div class="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg">
                  <div class="flex gap-3">
                    <PlayCircle
                      class={run.conclusion === 'success' ? 'text-green-600 dark:text-green-500' : run.conclusion === 'failure' ? 'text-red-600 dark:text-red-500' : 'text-slate-400 dark:text-slate-500'}
                      size={18}
                    />
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <a
                          href={run.html_url}
                          target="_blank"
                          rel="noreferrer"
                          class="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {run.name}
                        </a>
                        <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          run.status !== 'completed' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400' :
                          run.conclusion === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' :
                          run.conclusion === 'failure' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400' :
                          run.conclusion === 'cancelled' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {run.status === 'completed' ? run.conclusion : run.status}
                        </span>
                      </div>
                      <div class="text-xs text-slate-600 dark:text-slate-400">
                        Run #{run.run_number} • {run.head_branch} • {run.event}
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {new Date(run.created_at).toLocaleString()}
                      </div>

                      <Show when={state.artifacts.get(run.id)?.length > 0}>
                        <div class="mt-3 space-y-2">
                          <div class="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Package size={12} />
                            Artifacts ({state.artifacts.get(run.id).length})
                          </div>
                          <div class="space-y-1">
                            <For each={state.artifacts.get(run.id)}>{(artifact) =>
                              <div class="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
                                <div class="flex items-center gap-2 min-w-0">
                                  <Package size={14} class="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                  <span class="text-xs text-slate-700 dark:text-slate-300 truncate">{artifact.name}</span>
                                  <span class="text-xs text-slate-500 dark:text-slate-400">
                                    ({(artifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                </div>
                                <Show when={!artifact.expired}>
                                  <a
                                    href={artifact.archive_download_url}
                                    class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 text-xs flex-shrink-0"
                                    title="Download artifact"
                                  >
                                    <Download size={12} />
                                  </a>
                                </Show>
                              </div>
                            }</For>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              }</For>
            </div>
          </div>
        </Show>

        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <MessageCircle size={16} />
            Issue Comments ({state.comments.length})
          </h3>
          <Show when={state.loadingComments} fallback={
            <Show when={state.comments.length === 0} fallback={
              <div class="space-y-4">
                <For each={state.comments}>{(comment) =>
                  <div class="flex gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <img
                      src={comment.user.avatar_url}
                      alt={comment.user.login}
                      class="w-8 h-8 rounded-full flex-shrink-0"
                    />
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="font-medium text-slate-900 dark:text-slate-100">{comment.user.login}</span>
                        <span class="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Markdown content={comment.body} />
                    </div>
                  </div>
                }</For>
              </div>
            }>
              <div class="text-center text-slate-500 dark:text-slate-400 py-8 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                No comments yet. Be the first to comment!
              </div>
            </Show>
          }>
            <div class="space-y-4">
              <For each={[1,2,3]}>{(_) => <div class="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />}</For>
            </div>
          </Show>

          <div class="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Add a comment</h4>
            <div class="space-y-3">
              <textarea
                placeholder="Write your comment here..."
                value={state.issueCommentText}
                onInput={(e) => state.issueCommentText = e.target.value}
                class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
              />
              <div class="flex justify-end">
                <Button
                  variant="primary"
                  isLoading={state.isPostingComment}
                  disabled={state.isPostingComment || !state.issueCommentText.trim()}
                  onClick={handlePostIssueComment}
                  icon={<MessageCircle size={16} />}
                >
                  Post Comment
                </Button>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
