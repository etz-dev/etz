import { Command } from 'commander';
import ora from 'ora';
import { getBranches, getConfig } from '@etz/core';
import { theme, section } from '../ui/theme.js';
import { formatBranchList } from '../ui/formatters.js';
import { promptForRepo } from '../ui/prompts.js';
import { handleError } from '../utils/errors.js';

export function createBranchesCommand(): Command {
  const command = new Command('branches')
    .alias('br')
    .description('List all branches for a repository')
    .argument('[repo]', 'Repository name')
    .option('-j, --json', 'Output as JSON')
    .option('-i, --interactive', 'Prompt for repo selection')
    .action(async (repo: string | undefined, options) => {
      try {
        let selectedRepo = repo;

        // Interactive mode or no repo specified
        if (options.interactive || !selectedRepo) {
          const config = await getConfig();
          selectedRepo = await promptForRepo(config, 'Select repository:');
        }

        const spinner = ora({
          text: `Loading branches for ${selectedRepo}...`,
          color: 'cyan',
        }).start();

        const branches = await getBranches(selectedRepo);

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(branches, null, 2));
          return;
        }

        console.log(section(`Branches for ${selectedRepo}`));
        console.log(formatBranchList(branches));
        console.log('\n' + theme.dim(`Total: ${branches.length} branches`));
      } catch (err) {
        handleError(err);
      }
    });

  return command;
}
