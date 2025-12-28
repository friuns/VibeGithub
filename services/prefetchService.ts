// Service for prefetching and caching data for top repositories
// This enables instant loading when users navigate to repo details

import { Repository, Issue, WorkflowRun, PullRequestDetails, Deployment, DeploymentStatus, Artifact } from '../types';
import { fetchIssues, fetchWorkflowRuns, fetchPullRequestDetails, fetchDeploymentsBySha, fetchDeploymentStatuses, fetchArtifacts, fetchComments } from './githubService';
import { setCache, CacheKeys, CachedExpandedIssueData } from './cacheService';

/**
 * Prefetch all data needed for a single repository
 * This includes issues, workflow runs, PR details, deployments, and artifacts
 */
async function prefetchRepoData(token: string, repo: Repository): Promise<void> {
  try {
    // Fetch issues and workflow runs in parallel
    const [issues, workflowRuns] = await Promise.all([
      fetchIssues(token, repo.owner.login, repo.name).catch(() => [] as Issue[]),
      fetchWorkflowRuns(token, repo.owner.login, repo.name).catch(() => [] as WorkflowRun[])
    ]);

    // Cache issues and workflow runs immediately
    setCache(CacheKeys.repoIssues(repo.owner.login, repo.name), issues);
    setCache(CacheKeys.workflowRuns(repo.owner.login, repo.name), workflowRuns);

    // Get all PRs from the issues list
    const pullRequestsOnly = issues.filter(i => i.pull_request);

    // For each issue, prefetch its expanded data (comments, related PRs, etc.)
    // We'll prioritize the first 5 issues since they're most likely to be viewed
    const issuesToPrefetch = issues.filter(i => !i.pull_request).slice(0, 5);

    for (const issue of issuesToPrefetch) {
      try {
        await prefetchIssueExpandedData(token, repo, issue, issues, workflowRuns);
      } catch (err) {
        // Continue with other issues if one fails
        console.error(`Failed to prefetch data for issue #${issue.number}:`, err);
      }
    }

    // Prefetch PR details for all PRs (up to 10)
    const prsToCache = pullRequestsOnly.slice(0, 10);
    const prDetailPromises = prsToCache.map(async (pr) => {
      try {
        const details = await fetchPullRequestDetails(token, repo.owner.login, repo.name, pr.number);
        setCache(CacheKeys.prDetails(repo.owner.login, repo.name, pr.number), details);
        return { prNumber: pr.number, details };
      } catch {
        return { prNumber: pr.number, details: null };
      }
    });

    await Promise.all(prDetailPromises);
  } catch (err) {
    console.error(`Failed to prefetch data for repo ${repo.full_name}:`, err);
  }
}

/**
 * Prefetch expanded data for a specific issue
 * This is the complete dataset needed when viewing issue details
 */
async function prefetchIssueExpandedData(
  token: string,
  repo: Repository,
  issue: Issue,
  allIssues: Issue[],
  workflowRuns: WorkflowRun[]
): Promise<void> {
  try {
    // Fetch comments for this issue
    const comments = await fetchComments(token, repo.owner.login, repo.name, issue.number).catch(() => []);

    // Find related PRs
    const pullRequestsOnly = allIssues.filter(i => i.pull_request);
    const relatedPRs = pullRequestsOnly.filter(pr => {
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

    // Fetch comments for related PRs
    const prCommentPromises = relatedPRs.map(async (pr) => {
      try {
        const prComments = await fetchComments(token, repo.owner.login, repo.name, pr.number);
        return { prNumber: pr.number, comments: prComments };
      } catch {
        return { prNumber: pr.number, comments: [] };
      }
    });

    const prCommentResults = await Promise.all(prCommentPromises);
    const prCommentsMap = new Map<number, any[]>();
    prCommentResults.forEach(({ prNumber, comments: prComments }) => {
      prCommentsMap.set(prNumber, prComments);
    });

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

    // Fetch artifacts only for workflow runs that match related PR SHAs
    const relatedRunsForArtifacts = workflowRuns
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

    // Cache ALL expanded data together for instant display
    const dataToCache: CachedExpandedIssueData = {
      comments,
      workflowRuns,
      prDetails: Object.fromEntries(prDetailMap),
      deploymentsByPr: Object.fromEntries(deploymentsMap),
      artifacts: Object.fromEntries(artifactMap),
      prComments: Object.fromEntries(prCommentsMap),
    };
    setCache(CacheKeys.issueExpandedData(repo.owner.login, repo.name, issue.number), dataToCache);
  } catch (err) {
    console.error(`Failed to prefetch expanded data for issue #${issue.number}:`, err);
  }
}

/**
 * Prefetch data for the top N repositories
 * This is called on app startup to populate the cache with frequently accessed data
 * 
 * @param token - GitHub access token
 * @param repos - List of repositories, ordered by priority (most recent first)
 * @param count - Number of top repos to prefetch (default: 4)
 */
export async function prefetchTopReposData(
  token: string,
  repos: Repository[],
  count: number = 4
): Promise<void> {
  // Take the top N repos
  const topRepos = repos.slice(0, count);

  // Prefetch data for each repo sequentially to avoid rate limiting
  // We could do this in parallel, but sequential is safer for API limits
  for (const repo of topRepos) {
    await prefetchRepoData(token, repo);
  }
}
