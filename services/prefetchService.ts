// Prefetch service - loads data for top repos on startup
import { Repository, Issue, WorkflowRun, PullRequestDetails, Deployment, DeploymentStatus, Comment } from '../types';
import {
  fetchRepositories,
  fetchIssues,
  fetchWorkflowRuns,
  fetchPullRequestDetails,
  fetchDeploymentsBySha,
  fetchDeploymentStatuses,
  fetchComments
} from './githubService';
import { setCache, getCached, isCacheFresh, CacheKeys, CachedExpandedIssueData } from './cacheService';

const TOP_REPOS_COUNT = 4;
const PREFETCH_TTL = 2 * 60 * 1000; // 2 minutes - consider prefetch fresh for this long

interface PrefetchStatus {
  lastPrefetch: number;
  repoIds: number[];
}

/**
 * Check if we should run prefetch (not run recently)
 */
function shouldPrefetch(): boolean {
  const status = getCached<PrefetchStatus>(CacheKeys.prefetchStatus());
  if (!status) return true;
  return Date.now() - status.lastPrefetch > PREFETCH_TTL;
}

/**
 * Prefetch data for a single repo - issues, workflow runs, PRs, deployments
 */
async function prefetchRepoData(token: string, repo: Repository): Promise<void> {
  const owner = repo.owner.login;
  const repoName = repo.name;

  // Fetch issues
  const issues = await fetchIssues(token, owner, repoName);
  setCache(CacheKeys.repoIssues(owner, repoName), issues);

  // Fetch workflow runs
  const workflowRuns = await fetchWorkflowRuns(token, owner, repoName).catch(() => []);
  setCache(CacheKeys.workflowRuns(owner, repoName), workflowRuns);

  // Find PRs and fetch their details
  const prs = issues.filter(i => i.pull_request);
  const actualIssues = issues.filter(i => !i.pull_request);

  // Prefetch expanded data for all issues (up to limit)
  const issuesToPrefetch = actualIssues.slice(0, MAX_ISSUES_PER_REPO);

  // Prefetch in batches of 3 to avoid rate limiting
  for (let i = 0; i < issuesToPrefetch.length; i += 3) {
    const batch = issuesToPrefetch.slice(i, i + 3);
    await Promise.all(batch.map(issue =>
      prefetchIssueExpandedData(token, repo, issue, prs, workflowRuns)
    ));
  }
}

/**
 * Prefetch expanded data for a single issue
 */
async function prefetchIssueExpandedData(
  token: string,
  repo: Repository,
  issue: Issue,
  allPrs: Issue[],
  workflowRuns: WorkflowRun[]
): Promise<void> {
  const owner = repo.owner.login;
  const repoName = repo.name;
  const expandedCacheKey = CacheKeys.issueExpandedData(owner, repoName, issue.number);

  // Skip if already cached and fresh
  if (isCacheFresh(expandedCacheKey)) {
    return;
  }

  try {
    // Fetch issue comments
    const comments = await fetchComments(token, owner, repoName, issue.number);

    // Find related PRs (PRs that reference this issue)
    const relatedPRs = allPrs.filter(pr => {
      const issueRef = `#${issue.number}`;
      const titleMatch = pr.title?.toLowerCase().includes(issueRef.toLowerCase());
      const bodyMatch = pr.body?.toLowerCase().includes(issueRef.toLowerCase());
      return titleMatch || bodyMatch;
    });

    // Fetch PR details
    const prDetailMap: Record<number, PullRequestDetails> = {};
    const prCommentsMap: Record<number, Comment[]> = {};

    await Promise.all(relatedPRs.map(async (pr) => {
      try {
        const details = await fetchPullRequestDetails(token, owner, repoName, pr.number);
        prDetailMap[pr.number] = details;

        // Fetch PR comments
        const prComments = await fetchComments(token, owner, repoName, pr.number);
        prCommentsMap[pr.number] = prComments;
      } catch {
        // Skip failed PRs
      }
    }));

    // Collect PR head SHAs for filtering workflow runs
    const relatedShas = new Set<string>();
    Object.values(prDetailMap).forEach(details => {
      if (details.head?.sha) relatedShas.add(details.head.sha);
    });

    // Fetch deployments for each related PR
    const deploymentsByPr: Record<number, { deployment: Deployment; status: DeploymentStatus | null }[]> = {};

    await Promise.all(Object.entries(prDetailMap).map(async ([prNumberStr, details]) => {
      const prNumber = Number(prNumberStr);
      try {
        const deployments = await fetchDeploymentsBySha(token, owner, repoName, details.head.sha);
        const latest = deployments[0];
        if (latest) {
          const statuses = await fetchDeploymentStatuses(token, owner, repoName, latest.id).catch(() => []);
          const latestStatus = statuses[0] || null;
          deploymentsByPr[prNumber] = [{ deployment: latest, status: latestStatus }];
        } else {
          deploymentsByPr[prNumber] = [];
        }
      } catch {
        deploymentsByPr[prNumber] = [];
      }
    }));

    // Filter workflow runs to only those related to PRs
    const relatedRuns = workflowRuns.filter(run => run.head_sha && relatedShas.has(run.head_sha));

    // We don't prefetch artifacts as they're rarely needed and expensive

    // Cache the expanded data
    const dataToCache: CachedExpandedIssueData = {
      comments,
      workflowRuns: relatedRuns,
      prDetails: prDetailMap,
      deploymentsByPr,
      artifacts: {}, // Don't prefetch artifacts
      prComments: prCommentsMap,
    };
    setCache(expandedCacheKey, dataToCache);
  } catch (err) {
    console.warn(`Failed to prefetch issue #${issue.number}:`, err);
  }
}

/**
 * Main prefetch function - call on app startup
 * Fetches data for top 4 repos: issues, workflow runs, PR details, deployments
 */
export async function prefetchTopRepos(token: string): Promise<void> {
  // Skip if recently prefetched
  if (!shouldPrefetch()) {
    console.log('[Prefetch] Skipping - recently prefetched');
    return;
  }

  console.log('[Prefetch] Starting prefetch for top repos...');

  try {
    // Fetch repos first
    const repos = await fetchRepositories(token);
    setCache(CacheKeys.repos(), repos);

    // Take top N repos
    const topRepos = repos.slice(0, TOP_REPOS_COUNT);

    // Prefetch data for each repo in parallel
    await Promise.all(topRepos.map(repo => prefetchRepoData(token, repo)));

    // Update prefetch status
    const status: PrefetchStatus = {
      lastPrefetch: Date.now(),
      repoIds: topRepos.map(r => r.id),
    };
    setCache(CacheKeys.prefetchStatus(), status);

    console.log(`[Prefetch] Completed for ${topRepos.length} repos`);
  } catch (err) {
    console.error('[Prefetch] Failed:', err);
  }
}
