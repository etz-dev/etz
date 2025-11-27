#!/usr/bin/env node

import { Command } from 'commander';
import { createListCommand } from './commands/list.js';
import { createSwitchCommand } from './commands/switch.js';
import { createCleanCommand } from './commands/clean.js';
import { createDoctorCommand } from './commands/doctor.js';
import { createOpenCommand } from './commands/open.js';
import { createBranchesCommand } from './commands/branches.js';
import { createBuildCommand } from './commands/build.js';
import { theme, box } from './ui/theme.js';
import { handleError } from './utils/errors.js';

// Package info
const packageJson = require('../package.json');

async function main() {
  const program = new Command();

  program
    .name('etz')
    .description(theme.bold('etz - Beautiful worktree management for git repositories'))
    .version(packageJson.version, '-v, --version', 'Output the current version')
    .helpOption('-h, --help', 'Display help for command');

  // Add commands
  program.addCommand(createListCommand());
  program.addCommand(createSwitchCommand());
  program.addCommand(createCleanCommand());
  program.addCommand(createDoctorCommand());
  program.addCommand(createOpenCommand());
  program.addCommand(createBranchesCommand());
  program.addCommand(createBuildCommand());

  // Custom help
  program.on('--help', () => {
    console.log();
    console.log(theme.bold('Examples:'));
    console.log();
    console.log(theme.dim('  # List all worktrees'));
    console.log(theme.highlight('  $ etz list'));
    console.log();
    console.log(theme.dim('  # Create a new worktree'));
    console.log(theme.highlight('  $ etz new feature-branch'));
    console.log();
    console.log(theme.dim('  # Create worktree with custom branches per repo'));
    console.log(theme.highlight('  $ etz new -l my-feature -b ios:feat-ios -b android:feat-android'));
    console.log();
    console.log(theme.dim('  # Interactive mode'));
    console.log(theme.highlight('  $ etz new --interactive'));
    console.log();
    console.log(theme.dim('  # Delete a worktree'));
    console.log(theme.highlight('  $ etz delete feature-branch'));
    console.log();
    console.log(theme.dim('  # Open a worktree in editor'));
    console.log(theme.highlight('  $ etz open feature-branch ios'));
    console.log();
    console.log(theme.dim('  # Check environment health'));
    console.log(theme.highlight('  $ etz doctor'));
    console.log();
    console.log(theme.bold('Documentation:'));
    console.log(theme.info('  https://github.com/your-org/etz'));
    console.log();
  });

  // Show welcome banner on no arguments
  if (process.argv.length === 2) {
    console.log(
      box(
        `${theme.rocketIcon} ${theme.bold('etz - Worktree Management')}\n\n` +
        `Version: ${theme.highlight(packageJson.version)}\n\n` +
        `${theme.dim('Run')} ${theme.highlight('etz --help')} ${theme.dim('to get started')}`,
        {
          title: 'Welcome',
          borderColor: 'cyan',
        }
      )
    );
    process.exit(0);
  }

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    handleError(err);
  }
}

main();
