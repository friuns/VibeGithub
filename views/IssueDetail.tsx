import React, { useEffect, useState } from 'react';
import { Repository, Issue, Comment, WorkflowRun, Artifact, PullRequestDetails, Deployment, DeploymentStatus } from '../types';
import { fetchIssues, fetchComments, fetchWorkflowRuns, fetchArtifacts, fetchPullRequestDetails, fetchDeploymentsBySha, fetchDeploymentStatuses, mergePullRequest, createIssueComment } from '../services/githubService';
import { Button } from '../components/Button';
import { ToastContainer, useToast } from '../components/Toast';
import { Markdown } from '../components/Markdown';
import { ArrowLeft, MessageCircle, AlertCircle, CheckCircle2, GitPullRequest, PlayCircle, Package, Download, Rocket, RefreshCw } from 'lucide-react';
import { getCached, setCache, CacheKeys, CachedExpandedIssueData } from '../services/cacheService';

interface IssueDetailProps {
  token: string;
  repo: Repository;
  issue: Issue;
  onBack: () => void;
  accountId: string;
}

export const IssueDetail: React.FC<IssueDetailProps> = ({ token, repo, issue, onBack, accountId }) => {
  const { toasts, dismissToast, showSuccess, showError, showInfo } = useToast();
  
  // Cache keys
  const issuesCacheKey = CacheKeys.repoIssues(repo.owner.login, repo.name, accountId);
  const expandedCacheKey = CacheKeys.issueExpandedData(repo.owner.login, repo.name, issue.number, accountId);
  
  // Get cached data for instant display
  const cachedData = getCached<CachedExpandedIssueData>(expandedCacheKey);
  
  // State - initialize from cache if available
  const [comments, setComments] = useState<Comment[]>(() => cachedData?.comments || []);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>(() => cachedData?.workflowRuns || []);
  const [prDetails, setPrDetails] = useState<Map<number, PullRequestDetails>>(() => {
    if (cachedData?.prDetails) {
      return new Map(Object.entries(cachedData.prDetails).map(([k, v]) => [Number(k), v]));
    }
    return new Map();
  });
  const [deploymentsByPr, setDeploymentsByPr] = useState<Map<number, { deployment: Deployment; status: DeploymentStatus | null }[]>>(() => {
    if (cachedData?.deploymentsByPr) {
      return new Map(Object.entries(cachedData.deploymentsByPr).map(([k, v]) => [Number(k), v]));
    }
    return new Map();
  });
  const [artifacts, setArtifacts] = useState<Map<number, Artifact[]>>(() => {
    if (cachedData?.artifacts) {
      return new Map(Object.entries(cachedData.artifacts).map(([k, v]) => [Number(k), v]));
    }
    return new Map();
  });
  const [prComments, setPrComments] = useState<Map<number, Comment[]>>(() => {
    if (cachedData?.prComments) {
      return new Map(Object.entries(cachedData.prComments).map(([k, v]) => [Number(k), v]));
    }
    return new Map();
  });
  
  // Loading states - only show loading if no cached data
  const [loadingComments, setLoadingComments] = useState(!cachedData);
  const [loadingWorkflows, setLoadingWorkflows] = useState(!cachedData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // PR interaction states
  const [mergingPrNumber, setMergingPrNumber] = useState<number | null>(null);
  const [commentingPrNumber, setCommentingPrNumber] = useState<number | null>(null);
  const [prCommentTexts, setPrCommentTexts] = useState<Map<number, string>>(new Map());
  
  // Issue comment state
  const [issueCommentText, setIssueCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  
  // All issues (needed to find related PRs)
  const [allIssues, setAllIssues] = useState<Issue[]>(() => {
    return getCached<Issue[]>(issuesCacheKey) || [];
  });
  
  // Filter out pull requests
  const pullRequestsOnly = allIssues.filter(i => i.pull_request);

  const loadData = React.useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else if (!cachedData) {
      setLoadingComments(true);
      setLoadingWorkflows(true);
    }

    try {
      // Fetch fresh issues list too (for finding related PRs)
      const [issuesList, issueComments, runs] = await Promise.all([
        fetchIssues(token, repo.owner.login, repo.name),
        fetchComments(token, repo.owner.login, repo.name, issue.number),
        fetchWorkflowRuns(token, repo.owner.login, repo.name).catch(() => [])
      ]);
      
      setAllIssues(issuesList);
      setCache(issuesCacheKey, issuesList);
      setComments(issueComments);
      setWorkflowRuns(runs);

      // Get related PRs from fresh list
      const freshPullRequestsOnly = issuesList.filter(i => i.pull_request);
      const relatedPRs = freshPullRequestsOnly.filter(pr => {
        const issueRef = `#${issue.number}`;
        const titleMatch = pr.title?.toLowerCase().includes(issueRef.toLowerCase());
        const bodyMatch = pr.body?.toLowerCase().includes(issueRef.toLowerCase());
        return titleMatch || bodyMatch;
      });

      // Fetch detailed PR info for related PRs
      const prDetailPromises = relatedPRs.map(async (pr) => {
        try {
          const details = await fetchPullRequestDetails(token, repo.owner.login, repo.name, pr.number);
          return { prNumber: pr.number, details };
        } catch {
          return { prNumber: pr.number, details: null };
        }
      });

      const prDetailResults = await Promise.all(prDetailPromises);
      const prDetailMap = new Map<number, PullRequestDetails>();
      prDetailResults.forEach(({ prNumber, details }) => {
        if (details) prDetailMap.set(prNumber, details);
      });
      setPrDetails(prDetailMap);

      // Fetch comments for related PRs
      const prCommentPromises = relatedPRs.map(async (pr) => {
        try {
          const prCommentsList = await fetchComments(token, repo.owner.login, repo.name, pr.number);
          return { prNumber: pr.number, comments: prCommentsList };
        } catch {
          return { prNumber: pr.number, comments: [] };
        }
      });

      const prCommentResults = await Promise.all(prCommentPromises);
      const prCommentsMap = new Map<number, Comment[]>();
      prCommentResults.forEach(({ prNumber, comments: prCommentsList }) => {
        prCommentsMap.set(prNumber, prCommentsList);
      });
      setPrComments(prCommentsMap);

      // Compute related PR head SHAs
      const relatedShas = new Set<string>();
      prDetailMap.forEach((details) => {
        if (details.head?.sha) relatedShas.add(details.head.sha);
      });

      // Fetch deployments for each related PR
      const deploymentsPromises = Array.from(prDetailMap.entries()).map(async ([prNumber, details]) => {
        try {
          const deployments = await fetchDeploymentsBySha(token, repo.owner.login, repo.name, details.head.sha);
          const latest = deployments[0];
          if (!latest) return { prNumber, items: [] as { deployment: Deployment; status: DeploymentStatus | null }[] };
          const statuses = await fetchDeploymentStatuses(token, repo.owner.login, repo.name, latest.id).catch(() => [] as DeploymentStatus[]);
          const latestStatus = statuses[0] || null;
          return { prNumber, items: [{ deployment: latest, status: latestStatus }] };
        } catch {
          return { prNumber, items: [] as { deployment: Deployment; status: DeploymentStatus | null }[] };
        }
      });

      const deploymentsResults = await Promise.all(deploymentsPromises);
      const deploymentsMap = new Map<number, { deployment: Deployment; status: DeploymentStatus | null }[]>();
      deploymentsResults.forEach(({ prNumber, items }) => {
        deploymentsMap.set(prNumber, items);
      });
      setDeploymentsByPr(deploymentsMap);

      // Fetch artifacts only for workflow runs that match related PR SHAs
      const relatedRunsForArtifacts = runs
        .filter(r => r.head_sha && relatedShas.has(r.head_sha))
        .slice(0, 10);

      const artifactPromises = relatedRunsForArtifacts.map(async (run) => {
        try {
          const runArtifacts = await fetchArtifacts(token, repo.owner.login, repo.name, run.id);
          return { runId: run.id, artifacts: runArtifacts };
        } catch {
          return { runId: run.id, artifacts: [] };
        }
      });

      const artifactResults = await Promise.all(artifactPromises);
      const artifactMap = new Map<number, Artifact[]>();
      artifactResults.forEach(({ runId, artifacts: runArtifacts }) => {
        artifactMap.set(runId, runArtifacts);
      });
      setArtifacts(artifactMap);
      
      // Cache ALL expanded data together for instant display next time
      const dataToCache: CachedExpandedIssueData = {
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
      setComments([]);
      setWorkflowRuns([]);
    } finally {
      setLoadingComments(false);
      setLoadingWorkflows(false);
      setIsRefreshing(false);
    }
  }, [token, repo, issue, cachedData, issuesCacheKey, expandedCacheKey]);

  useEffect(() => {
    loadData(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMergePR = async (prNumber: number) => {
    setMergingPrNumber(prNumber);
    try {
      await mergePullRequest(token, repo.owner.login, repo.name, prNumber, 'squash');
      // refresh PR details
      const details = await fetchPullRequestDetails(token, repo.owner.login, repo.name, prNumber);
      setPrDetails(prev => {
        const next = new Map(prev);
        next.set(prNumber, details);
        return next;
      });
      showSuccess('Pull request merged successfully');
    } catch (err: any) {
      showError(err?.message || 'Failed to merge pull request');
    } finally {
      setMergingPrNumber(null);
    }
  };

  const handleCommentJulesOnPR = async (prNumber: number) => {
    const userComment = prCommentTexts.get(prNumber) || '';
    if (!userComment.trim()) {
      showInfo('Please enter a comment');
      return;
    }
    
    setCommentingPrNumber(prNumber);
    try {
      const body = `${userComment.trim()} @jules`;
      await createIssueComment(token, repo.owner.login, repo.name, prNumber, body);
      showSuccess('Comment posted');
      setPrCommentTexts(prev => {
        const next = new Map(prev);
        next.delete(prNumber);
        return next;
      });
    } catch (err: any) {
      showError(err?.message || 'Failed to post comment');
    } finally {
      setCommentingPrNumber(null);
    }
  };

  const handlePostIssueComment = async () => {
    if (!issueCommentText.trim()) {
      showInfo('Please enter a comment');
      return;
    }
    
    setIsPostingComment(true);
    try {
      const newComment = await createIssueComment(token, repo.owner.login, repo.name, issue.number, issueCommentText.trim());
      setComments(prev => [...prev, newComment]);
      setIssueCommentText('');
      showSuccess('Comment posted successfully');
    } catch (err: any) {
      showError(err?.message || 'Failed to post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Get related pull requests for the issue
  const getRelatedPullRequests = (): Issue[] => {
    return pullRequestsOnly.filter(pr => {
      const issueRef = `#${issue.number}`;
      const titleMatch = pr.title?.toLowerCase().includes(issueRef.toLowerCase());
      const bodyMatch = pr.body?.toLowerCase().includes(issueRef.toLowerCase());
      return titleMatch || bodyMatch;
    });
  };

  // Get related workflow runs
  const getRelatedWorkflowRuns = (): WorkflowRun[] => {
    const relatedPRs = getRelatedPullRequests();
    if (relatedPRs.length === 0) return [];
    
    const prShas = new Set<string>();
    relatedPRs.forEach(pr => {
      const details = prDetails.get(pr.number);
      if (details) {
        if (details.head?.sha) prShas.add(details.head.sha);
      }
    });
    
    return workflowRuns.filter(run => run.head_sha && prShas.has(run.head_sha));
  };

  const relatedPRs = getRelatedPullRequests();
  const relatedRuns = getRelatedWorkflowRuns();

  const getDeployBadge = (state: DeploymentStatus['state']) => {
    switch (state) {
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

  const prNumbers = relatedPRs.map(pr => pr.number);
  const deploymentItems = prNumbers.flatMap((n) => (deploymentsByPr.get(n) || []).map((it) => ({ prNumber: n, ...it })));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={18} />}>
            Back
          </Button>
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2">
              {issue.state === 'open' ? (
                <AlertCircle className="text-green-600 dark:text-green-500 flex-shrink-0" size={18} />
              ) : (
                <CheckCircle2 className="text-slate-400 dark:text-slate-500 flex-shrink-0" size={18} />
              )}
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{issue.title}</h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{repo.full_name} · Issue #{issue.number}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isRefreshing && (
              <span className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>
            )}
            <Button variant="secondary" onClick={() => loadData(true)} icon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />} disabled={isRefreshing}>
              Refresh
            </Button>
            <a
              href={issue.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Issue Body */}
        {issue.body && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <MessageCircle size={16} />
              Description
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <Markdown>{issue.body}</Markdown>
            </div>
          </div>
        )}

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {issue.labels.map(label => (
              <span
                key={label.id}
                className="px-3 py-1 rounded-full text-xs font-medium border"
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
        )}

        {/* Pull Requests Section */}
        {!loadingComments && relatedPRs.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <GitPullRequest size={16} />
              Related Pull Requests ({relatedPRs.length})
            </h3>
            <div className="space-y-6">
              {relatedPRs.map(pr => {
                const thisPrComments = prComments.get(pr.number) || [];
                return (
                  <div key={pr.id} className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                    {/* PR Header */}
                    <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/30">
                      <GitPullRequest 
                        className={pr.state === 'open' ? "text-green-600 dark:text-green-500" : "text-purple-600 dark:text-purple-500"} 
                        size={18} 
                      />
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <a
                            href={pr.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {pr.title}
                          </a>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            pr.state === 'open' 
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' 
                              : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400'
                          }`}>
                            {pr.state}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          #{pr.number} opened by {pr.user.login}
                        </div>
                        {pr.body && (
                          <div className="mt-2 line-clamp-3 overflow-hidden">
                            <Markdown>{pr.body}</Markdown>
                          </div>
                        )}
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={mergingPrNumber === pr.number}
                              disabled={mergingPrNumber !== null || pr.state !== 'open'}
                              onClick={() => handleMergePR(pr.number)}
                            >
                              Merge
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Write your comment..."
                              value={prCommentTexts.get(pr.number) || ''}
                              onChange={(e) => {
                                setPrCommentTexts(prev => {
                                  const next = new Map(prev);
                                  next.set(pr.number, e.target.value);
                                  return next;
                                });
                              }}
                              className="flex-grow px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={commentingPrNumber === pr.number}
                              disabled={commentingPrNumber !== null}
                              onClick={() => handleCommentJulesOnPR(pr.number)}
                            >
                              Send @jules
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* PR Comments */}
                    {thisPrComments.length > 0 && (
                      <div className="border-t border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 p-4">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                          <MessageCircle size={12} />
                          {thisPrComments.length} comment{thisPrComments.length !== 1 ? 's' : ''}
                        </div>
                        <div className="space-y-3">
                          {thisPrComments.map(comment => (
                            <div key={comment.id} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                              <img
                                src={comment.user.avatar_url}
                                alt={comment.user.login}
                                className="w-7 h-7 rounded-full flex-shrink-0"
                              />
                              <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{comment.user.login}</span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <Markdown>{comment.body}</Markdown>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Deployments Section */}
        {!loadingWorkflows && deploymentItems.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Rocket size={16} />
              Related Deployments ({deploymentItems.length})
            </h3>
            <div className="space-y-3">
              {deploymentItems.map(({ prNumber, deployment, status }) => (
                <div key={`${deployment.id}`} className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Rocket className="text-slate-500 dark:text-slate-400" size={18} />
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {deployment.environment}
                        </div>
                        {status && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDeployBadge(status.state)}`}>
                            {status.state}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        PR #{prNumber} • {new Date(deployment.created_at).toLocaleString()}
                      </div>
                      {(status?.environment_url || status?.log_url) && (
                        <div className="text-xs mt-2 flex gap-3">
                          {status?.environment_url && (
                            <a
                              href={status.environment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              Open environment
                            </a>
                          )}
                          {status?.log_url && (
                            <a
                              href={status.log_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              View logs
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GitHub Actions Section */}
        {!loadingWorkflows && relatedRuns.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <PlayCircle size={16} />
              Related Actions ({relatedRuns.length})
            </h3>
            <div className="space-y-3">
              {relatedRuns.slice(0, 5).map(run => {
                const runArtifacts = artifacts.get(run.id) || [];
                const getStatusColor = () => {
                  if (run.status !== 'completed') return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400';
                  switch (run.conclusion) {
                    case 'success': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400';
                    case 'failure': return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400';
                    case 'cancelled': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                    default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
                  }
                };
                
                return (
                  <div key={run.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg">
                    <div className="flex gap-3">
                      <PlayCircle 
                        className={run.conclusion === 'success' ? 'text-green-600 dark:text-green-500' : run.conclusion === 'failure' ? 'text-red-600 dark:text-red-500' : 'text-slate-400 dark:text-slate-500'} 
                        size={18} 
                      />
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <a
                            href={run.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {run.name}
                          </a>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor()}`}>
                            {run.status === 'completed' ? run.conclusion : run.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Run #{run.run_number} • {run.head_branch} • {run.event}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {new Date(run.created_at).toLocaleString()}
                        </div>
                        
                        {/* Artifacts */}
                        {runArtifacts.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <Package size={12} />
                              Artifacts ({runArtifacts.length})
                            </div>
                            <div className="space-y-1">
                              {runArtifacts.map(artifact => (
                                <div key={artifact.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Package size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{artifact.name}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      ({(artifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB)
                                    </span>
                                  </div>
                                  {!artifact.expired && (
                                    <a
                                      href={artifact.archive_download_url}
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 text-xs flex-shrink-0"
                                      title="Download artifact"
                                    >
                                      <Download size={12} />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <MessageCircle size={16} />
            Issue Comments ({comments.length})
          </h3>
          {loadingComments ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />)}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-8 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <img
                    src={comment.user.avatar_url}
                    alt={comment.user.login}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{comment.user.login}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Markdown>{comment.body}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Add Comment Input */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Add a comment</h4>
            <div className="space-y-3">
              <textarea
                placeholder="Write your comment here..."
                value={issueCommentText}
                onChange={(e) => setIssueCommentText(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  isLoading={isPostingComment}
                  disabled={isPostingComment || !issueCommentText.trim()}
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
