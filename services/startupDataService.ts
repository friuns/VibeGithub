// Startup data prefetcher for top repos
import { Repository, Issue } from '../types';
import { fetchIssues, fetchPullRequestDetails, fetchWorkflowRuns, fetchDeploymentsBySha, fetchDeploymentStatuses } from './githubService';
import { setCache, CacheKeys, getCached } from './cacheService';

export async function prefetchTopReposData(token: string, repos: Repository[]): Promise<void> {
  const topRepos = repos.slice(0, 4);

  for (const repo of topRepos) {
    try {
      // Fetch all issues (including PRs)
      const issues = await fetchIssues(token, repo.owner.login, repo.name);
      setCache(CacheKeys.repoIssues(repo.owner.login, repo.name), issues);

      // Get PRs from issues
      const prs = issues.filter(issue => issue.pull_request).slice(0, 10); // Limit to 10 PRs per repo

      // Fetch PR details and related data for each PR
      for (const pr of prs) {
        const prNumber = pr.number;

        // Fetch PR details
        const prDetails = await fetchPullRequestDetails(token, repo.owner.login, repo.name, prNumber);
        setCache(CacheKeys.prDetails(repo.owner.login, repo.name, prNumber), prDetails);

        // Fetch deployments for the PR's head SHA
        if (prDetails.head?.sha) {
          try {
            const deployments = await fetchDeploymentsBySha(token, repo.owner.login, repo.name, prDetails.head.sha);
            // Cache deployments keyed by SHA
            setCache(CacheKeys.deploymentsBySha(repo.owner.login, repo.name, prDetails.head.sha), deployments);

            // Fetch statuses for each deployment
            for (const deployment of deployments) {
              try {
                const statuses = await fetchDeploymentStatuses(token, repo.owner.login, repo.name, deployment.id);
                setCache(CacheKeys.deploymentStatuses(repo.owner.login, repo.name, deployment.id), statuses);
              } catch (statusErr) {
                console.warn('Failed to fetch deployment statuses:', statusErr);
              }
            }
          } catch (deployErr) {
            console.warn('Failed to fetch deployments:', deployErr);
          }
        }
      }

      // Fetch workflow runs for the repo
      try {
        const workflowRuns = await fetchWorkflowRuns(token, repo.owner.login, repo.name);
        setCache(CacheKeys.workflowRuns(repo.owner.login, repo.name), workflowRuns);
      } catch (workflowErr) {
        console.warn('Failed to fetch workflow runs:', workflowErr);
      }

    } catch (err) {
      console.warn(`Failed to prefetch data for repo ${repo.full_name}:`, err);
    }
  }
}