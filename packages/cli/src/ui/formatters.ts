import Table from 'cli-table3';
import { theme } from './theme.js';
import type { WorktreeInfo, GitStatus } from '@etz/core';

/**
 * Format git status with icons
 */
export function formatGitStatus(status: GitStatus): string {
  const parts: string[] = [];

  if (status.modified > 0 || status.staged > 0 || status.untracked > 0) {
    parts.push(`${theme.dirtyIcon} ${status.modified + status.staged + status.untracked} changes`);
  } else {
    parts.push(`${theme.cleanIcon} clean`);
  }

  if (status.ahead > 0) {
    parts.push(theme.info(`↑${status.ahead}`));
  }

  if (status.behind > 0) {
    parts.push(theme.warning(`↓${status.behind}`));
  }

  return parts.join(' ');
}

/**
 * Format worktree info as a table
 */
export function formatWorktreeTable(worktrees: WorktreeInfo[]): string {
  if (worktrees.length === 0) {
    return theme.muted('No worktrees found.');
  }

  const table = new Table({
    head: [
      theme.bold('Label'),
      theme.bold('Repo'),
      theme.bold('Branch'),
      theme.bold('Status'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    colWidths: [25, 25, 30, 30],
    wordWrap: true,
  });

  for (const worktree of worktrees) {
    const isFirst = true;
    for (let i = 0; i < worktree.repos.length; i++) {
      const repo = worktree.repos[i];
      const labelCell = i === 0 ? `${theme.folderIcon} ${theme.primary(worktree.label)}` : '';

      let statusText = repo.clean
        ? `${theme.cleanIcon} clean`
        : `${theme.dirtyIcon} ${theme.warning(`${repo.uncommitted} changes`)}`;

      table.push([
        labelCell,
        theme.secondary(repo.name),
        `${theme.branchIcon} ${theme.highlight(repo.branch)}`,
        statusText,
      ]);
    }

    // Add separator between worktrees
    if (worktrees.indexOf(worktree) < worktrees.length - 1) {
      table.push([{ colSpan: 4, content: theme.dim('─'.repeat(108)) }]);
    }
  }

  return table.toString();
}

/**
 * Format a list of items with bullets
 */
export function bulletList(items: string[]): string {
  return items.map(item => `  ${theme.info('•')} ${item}`).join('\n');
}

/**
 * Format key-value pairs
 */
export function keyValue(key: string, value: string): string {
  return `${theme.dim(key)}: ${theme.highlight(value)}`;
}

/**
 * Format a compact worktree summary
 */
export function formatWorktreeSummary(worktree: WorktreeInfo): string {
  const lines: string[] = [];
  lines.push(theme.bold(theme.primary(`${theme.folderIcon} ${worktree.label}`)));

  for (const repo of worktree.repos) {
    const status = repo.clean ? theme.cleanIcon : `${theme.dirtyIcon} ${repo.uncommitted}`;
    lines.push(`  ${theme.secondary(repo.name.padEnd(25))} ${theme.branchIcon} ${theme.highlight(repo.branch.padEnd(25))} ${status}`);
  }

  return lines.join('\n');
}

/**
 * Format branch list
 */
export function formatBranchList(branches: string[], currentBranch?: string): string {
  return branches
    .map(branch => {
      const isCurrent = branch === currentBranch;
      const icon = isCurrent ? theme.success('●') : theme.muted('○');
      const text = isCurrent ? theme.success.bold(branch) : theme.muted(branch);
      return `  ${icon} ${text}`;
    })
    .join('\n');
}
