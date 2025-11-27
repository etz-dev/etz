import { Command } from 'commander';
import { open as openWorktree, getWorktree } from '@etz/core';
import type { OpenOptions } from '@etz/core';
import { theme, success } from '../ui/theme.js';
import { promptForEditor, promptForRepo } from '../ui/prompts.js';
import { handleError } from '../utils/errors.js';
import { getConfig } from '@etz/core';

export function createOpenCommand(): Command {
  const command = new Command('open')
    .description('Open a worktree in an editor')
    .argument('<label>', 'Worktree label to open')
    .argument('[repo]', 'Specific repo to open')
    .option('-e, --editor <editor>', 'Editor to use (code, cursor, vim, etc.)')
    .option('-i, --interactive', 'Prompt for repo and editor selection')
    .action(async (label: string, repo: string | undefined, options) => {
      try {
        // Check if worktree exists
        const worktree = await getWorktree(label);

        if (!worktree) {
          console.log(theme.error(`Worktree '${label}' not found`));
          console.log('\n' + theme.info('List available worktrees:'));
          console.log(theme.highlight('  etz list'));
          process.exit(1);
        }

        let selectedRepo = repo;
        let selectedEditor = options.editor;

        // Interactive mode
        if (options.interactive) {
          const config = await getConfig();

          // Prompt for repo if not specified
          if (!selectedRepo) {
            selectedRepo = await promptForRepo(config, `Select repo to open from '${label}':`);
          }

          // Prompt for editor if not specified
          if (!selectedEditor) {
            selectedEditor = await promptForEditor();
          }
        }

        // Validate repo exists in worktree
        if (selectedRepo) {
          const repoExists = worktree.repos.some(r => r.name === selectedRepo);
          if (!repoExists) {
            console.log(theme.error(`Repo '${selectedRepo}' not found in worktree '${label}'`));
            console.log('\n' + theme.info('Available repos:'));
            worktree.repos.forEach(r => {
              console.log(`  ${theme.secondary(r.name)}`);
            });
            process.exit(1);
          }
        }

        const openOptions: OpenOptions = {
          label,
          repo: selectedRepo!,
          editor: selectedEditor,
        };

        const result = await openWorktree(openOptions);

        if (result.success) {
          console.log(success(result.message));
        } else {
          console.log(theme.error('Failed to open editor'));
          console.log(theme.dim(`  ${result.message}`));
          process.exit(1);
        }
      } catch (err) {
        handleError(err);
      }
    });

  return command;
}
