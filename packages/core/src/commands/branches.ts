import * as path from 'path';
import { getConfig } from '../config/parser';
import { getBranches as gitGetBranches, fetchRepo } from '../git/operations';

/**
 * Get list of branches for a repository
 */
export async function getBranches(repoName?: string): Promise<string[]> {
    const config = getConfig();

    // If no repo specified, use the first one in config
    let repo;
    if (repoName) {
        repo = config.repos.find(r => r.name === repoName);
        if (!repo) {
            throw new Error(`Repository '${repoName}' not found in configuration`);
        }
    } else {
        repo = config.repos[0];
        if (!repo) {
            throw new Error('No repositories configured');
        }
    }

    // Fetch latest changes to ensure we have up-to-date remote branches
    try {
        await fetchRepo(repo.base_path);
    } catch (error) {
        console.warn(`Failed to fetch repo ${repo.name}:`, error);
        // Continue anyway, working with local cache
    }

    return gitGetBranches(repo.base_path);
}
