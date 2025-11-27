import { Command } from 'commander';
import { Listr } from 'listr2';
import { switchToWorktree, getConfig, getBranches as getBranchesForRepo } from '@etz/core';
import type { SwitchOptions, SwitchResult } from '@etz/core';
import { theme, success, error, warning, section } from '../ui/theme.js';
import { promptForLabel, promptForBranch, promptForBranchInput } from '../ui/prompts.js';
import { handleError } from '../utils/errors.js';

export function createSwitchCommand(): Command {
  const command = new Command('new')
    .alias('switch')
    .alias('sw')
    .description('Create a new worktree')
    .argument('[branch]', 'Branch name (used as default for all repos)')
    .option('-l, --label <label>', 'Worktree label (folder name)')
    .option('-r, --repo <repo>', 'Only operate on specific repo')
    .option('-d, --default <branch>', 'Default branch for all repos')
    .option('-b, --branch <repo:branch>', 'Set branch for specific repo (can be used multiple times)', collect, [])
    .option('--dry-run', 'Preview without executing')
    .option('-i, --interactive', 'Interactive mode with prompts')
    .action(async (branch: string | undefined, options) => {
      try {
        const config = await getConfig();

        let label = options.label;
        let defaultBranch = branch || options.default;
        const branchMap: Record<string, string> = {};

        // Parse branch mappings (e.g., -b ios:feature-a -b android:feature-b)
        for (const mapping of options.branch) {
          const [repo, repoBranch] = mapping.split(':');
          if (!repo || !repoBranch) {
            throw new Error(`Invalid branch mapping: ${mapping}. Use format "repo:branch"`);
          }
          branchMap[repo] = repoBranch;
        }

        // Interactive mode
        if (options.interactive) {
          // Prompt for label
          if (!label) {
            label = await promptForLabel(defaultBranch);
          }

          // Prompt for branches for each repo
          for (const repo of config.repos) {
            if (options.repo && repo.name !== options.repo) {
              continue;
            }

            if (!branchMap[repo.name]) {
              console.log(`\n${theme.secondary(repo.name)}`);
              const branches = await getBranchesForRepo(repo.name);

              if (branches.length > 20) {
                // Too many branches, use input instead
                branchMap[repo.name] = await promptForBranchInput(repo.name, defaultBranch);
              } else {
                branchMap[repo.name] = await promptForBranch(repo.name, branches, defaultBranch);
              }
            }
          }
        }

        // Validate we have enough info
        if (!label && !defaultBranch && Object.keys(branchMap).length === 0) {
          console.log(error('Please provide a branch name or use --interactive mode'));
          console.log('\n' + theme.info('Examples:'));
          console.log(theme.highlight('  etz switch feature-branch'));
          console.log(theme.highlight('  etz switch --interactive'));
          console.log(theme.highlight('  etz switch -l my-label -d main -b ios:feature-a'));
          process.exit(1);
        }

        // Set label to default branch if not specified
        if (!label && defaultBranch) {
          label = defaultBranch;
        }

        const switchOptions: SwitchOptions = {
          label,
          default: defaultBranch,
          branchMap: Object.keys(branchMap).length > 0 ? branchMap : undefined,
          repo: options.repo,
          dryRun: options.dryRun,
        };

        if (options.dryRun) {
          console.log(section('Dry Run Preview'));
          console.log(theme.info(`Label: ${label}`));
          console.log(theme.info(`Default branch: ${defaultBranch || 'none'}`));
          if (Object.keys(branchMap).length > 0) {
            console.log(theme.info('Branch mappings:'));
            for (const [repo, branch] of Object.entries(branchMap)) {
              console.log(`  ${theme.secondary(repo)}: ${theme.highlight(branch)}`);
            }
          }
          console.log();
        }

        // Create tasks for each repo
        const tasks = new Listr([
          {
            title: 'Creating worktrees',
            task: async (ctx, task) => {
              const results = await switchToWorktree(switchOptions);
              ctx.results = results;

              return task.newListr(
                results.map((result) => ({
                  title: `${result.repoName}`,
                  task: async (_, subTask) => {
                    if (result.status === 'created_new') {
                      subTask.title = `${theme.newIcon} ${result.repoName}: ${result.message}`;
                    } else if (result.status === 'added_local') {
                      subTask.title = `${theme.successIcon} ${result.repoName}: ${result.message}`;
                    } else if (result.status === 'added_remote') {
                      subTask.title = `${theme.successIcon} ${result.repoName}: ${result.message}`;
                    } else if (result.status === 'already_exists') {
                      subTask.title = `${theme.infoIcon} ${result.repoName}: ${result.message}`;
                    } else if (result.status === 'already_in_use') {
                      subTask.title = `${theme.warningIcon} ${result.repoName}: ${result.message}`;
                      throw new Error(result.message);
                    } else if (result.status === 'error') {
                      subTask.title = `${theme.errorIcon} ${result.repoName}: Failed`;
                      throw new Error(result.message);
                    } else if (result.status === 'skipped') {
                      subTask.title = `${theme.muted('⊘')} ${result.repoName}: Skipped`;
                    }
                  },
                })),
                { concurrent: false }
              );
            },
          },
        ]);

        const context = await tasks.run();

        // Display results
        if (!options.dryRun) {
          console.log();
          console.log(success(`Worktree '${label}' is ready!`));

          const results = context.results as SwitchResult[];
          const created = results.filter(r => r.status === 'created_new').length;
          const added = results.filter(r => r.status === 'added_local' || r.status === 'added_remote').length;
          const existing = results.filter(r => r.status === 'already_exists').length;
          const errors = results.filter(r => r.status === 'error' || r.status === 'already_in_use').length;

          console.log();
          console.log(theme.dim('Summary:'));
          if (created > 0) console.log(`  ${theme.newIcon} ${created} new branches created`);
          if (added > 0) console.log(`  ${theme.successIcon} ${added} existing branches added`);
          if (existing > 0) console.log(`  ${theme.infoIcon} ${existing} already existed`);
          if (errors > 0) console.log(`  ${theme.errorIcon} ${errors} failed`);

          console.log();
          console.log(theme.info('Open in editor:'));
          console.log(theme.highlight(`  etz open ${label}`));
        }
      } catch (err) {
        handleError(err);
      }
    });

  return command;
}

// Helper to collect multiple option values
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
