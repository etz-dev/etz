import { Command } from 'commander';
import ora from 'ora';
import { list, getConfig } from '@etz/core';
import { formatWorktreeTable } from '../ui/formatters.js';
import { theme, section } from '../ui/theme.js';
import { handleError } from '../utils/errors.js';

export function createListCommand(): Command {
  const command = new Command('list')
    .alias('ls')
    .description('List all worktrees')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      try {
        const spinner = ora({
          text: 'Loading worktrees...',
          color: 'cyan',
        }).start();

        const worktrees = await list();

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(worktrees, null, 2));
          return;
        }

        console.log(section('Worktrees'));

        if (worktrees.length === 0) {
          console.log(theme.muted('  No worktrees found.'));
          console.log('\n' + theme.info('Create a new worktree:'));
          console.log(theme.highlight('  etz switch <branch-name>'));
          return;
        }

        console.log(formatWorktreeTable(worktrees));

        // Summary
        const totalRepos = worktrees.reduce((sum, wt) => sum + wt.repos.length, 0);
        console.log('\n' + theme.dim(`Total: ${worktrees.length} worktrees, ${totalRepos} repositories`));
      } catch (err) {
        handleError(err);
      }
    });

  return command;
}
