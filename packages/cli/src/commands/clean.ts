import { Command } from 'commander';
import { Listr } from 'listr2';
import { clean, getWorktree } from '@etz/core';
import type { CleanOptions } from '@etz/core';
import { theme, success, warning, section } from '../ui/theme.js';
import { formatWorktreeSummary } from '../ui/formatters.js';
import { promptForConfirmation } from '../ui/prompts.js';
import { handleError } from '../utils/errors.js';

export function createCleanCommand(): Command {
  const command = new Command('delete')
    .alias('clean')
    .alias('rm')
    .description('Delete a worktree')
    .argument('<label>', 'Worktree label to remove')
    .option('-r, --repo <repo>', 'Only clean specific repo')
    .option('-f, --force', 'Force deletion even if not a git worktree')
    .option('--delete-branches', 'Also delete local git branches')
    .option('--dry-run', 'Preview without executing')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (label: string, options) => {
      try {
        // Check if worktree exists
        const worktree = await getWorktree(label);

        if (!worktree) {
          console.log(theme.error(`Worktree '${label}' not found`));
          console.log('\n' + theme.info('List available worktrees:'));
          console.log(theme.highlight('  etz list'));
          process.exit(1);
        }

        // Show what will be deleted
        console.log(section('Worktree to be removed'));
        console.log(formatWorktreeSummary(worktree));
        console.log();

        if (options.deleteBranches) {
          console.log(warning('Local branches will also be deleted!'));
          console.log();
        }

        // Confirm deletion (unless --yes or --dry-run)
        if (!options.yes && !options.dryRun) {
          const confirmed = await promptForConfirmation(
            `Are you sure you want to delete '${label}'?`,
            false
          );

          if (!confirmed) {
            console.log(theme.muted('Cancelled.'));
            process.exit(0);
          }
        }

        if (options.dryRun) {
          console.log(theme.info('Dry run - no changes will be made'));
          console.log(theme.dim('Repos to be cleaned:'));
          for (const repo of worktree.repos) {
            console.log(`  ${theme.secondary(repo.name)} at ${repo.path}`);
          }
          return;
        }

        const cleanOptions: CleanOptions = {
          label,
          repo: options.repo,
          force: options.force,
          deleteBranches: options.deleteBranches,
          dryRun: false,
        };

        // Clean with progress
        const tasks = new Listr([
          {
            title: 'Cleaning worktrees',
            task: async (ctx, task) => {
              const results = await clean(cleanOptions);
              ctx.results = results;

              return task.newListr(
                results.map((result) => ({
                  title: result.repoName,
                  task: async (_, subTask) => {
                    if (result.status === 'deleted') {
                      subTask.title = `${theme.successIcon} ${result.repoName}: Deleted`;
                    } else if (result.status === 'not_found') {
                      subTask.title = `${theme.warningIcon} ${result.repoName}: Not found`;
                    } else if (result.status === 'error') {
                      subTask.title = `${theme.errorIcon} ${result.repoName}: Failed`;
                      throw new Error(result.message);
                    }
                  },
                })),
                { concurrent: false }
              );
            },
          },
        ]);

        await tasks.run();

        console.log();
        console.log(success(`Worktree '${label}' has been removed`));

        if (options.deleteBranches) {
          console.log(theme.dim('  Local branches deleted'));
        }
      } catch (err) {
        handleError(err);
      }
    });

  return command;
}
