import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config/parser';
import {
  listWorktrees,
  getCurrentBranch,
  getUncommittedCount,
  worktreeExists as gitWorktreeExists,
} from '../git/operations';
import { WorktreeInfo, RepoWorktreeInfo } from '../types';

/**
 * Get information about a specific worktree label
 */
async function getWorktreeInfo(label: string): Promise<WorktreeInfo | null> {
  const config = getConfig();
  const worktreeDir = path.join(config.worktrees_dir, label);

  // Check if worktree directory exists
  if (!fs.existsSync(worktreeDir)) {
    return null;
  }

  const repos: RepoWorktreeInfo[] = [];

  for (const repo of config.repos) {
    const repoWorktreePath = path.join(worktreeDir, repo.name);
    const exists = gitWorktreeExists(repoWorktreePath);

    if (exists) {
      try {
        const branch = await getCurrentBranch(repoWorktreePath);
        const uncommittedCount = await getUncommittedCount(repoWorktreePath);

        repos.push({
          name: repo.name,
          branch,
          path: repoWorktreePath,
          clean: uncommittedCount === 0,
          uncommitted: uncommittedCount,
          exists: true,
        });
      } catch (error) {
        // If we can't read git info, mark as exists but with no info
        repos.push({
          name: repo.name,
          branch: '?',
          path: repoWorktreePath,
          clean: false,
          uncommitted: 0,
          exists: true,
        });
      }
    } else {
      // Repo doesn't exist in this worktree
      repos.push({
        name: repo.name,
        branch: '',
        path: repoWorktreePath,
        clean: true,
        uncommitted: 0,
        exists: false,
      });
    }
  }

  return {
    label,
    repos,
  };
}

/**
 * List all worktrees by scanning the worktrees directory
 */
export async function list(): Promise<WorktreeInfo[]> {
  const config = getConfig();

  // Ensure worktrees directory exists
  if (!fs.existsSync(config.worktrees_dir)) {
    return [];
  }

  // Get all subdirectories in worktrees_dir
  const entries = fs.readdirSync(config.worktrees_dir, { withFileTypes: true });
  const labels = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => !name.startsWith('.')); // Exclude hidden directories

  // Get info for each worktree
  const worktrees: WorktreeInfo[] = [];

  for (const label of labels) {
    const info = await getWorktreeInfo(label);
    if (info) {
      worktrees.push(info);
    }
  }

  return worktrees;
}

/**
 * Get a specific worktree by label
 */
export async function getWorktree(label: string): Promise<WorktreeInfo | null> {
  return getWorktreeInfo(label);
}

/**
 * Check if a worktree with the given label exists
 */
export async function worktreeExists(label: string): Promise<boolean> {
  const config = getConfig();
  const worktreeDir = path.join(config.worktrees_dir, label);
  return fs.existsSync(worktreeDir);
}
