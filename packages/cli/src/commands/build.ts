import { Command } from 'commander';
import ora from 'ora';
import {
  buildIOS,
  buildAndroid,
  getWorktree,
} from '@etz/core';
import { theme, success, error, warning, section } from '../ui/theme.js';
import { handleError } from '../utils/errors.js';

export function createBuildCommand(): Command {
  const buildCmd = new Command('build')
    .description('Build commands for iOS and Android');

  // iOS build
  buildCmd
    .command('ios')
    .description('Build iOS application')
    .argument('<label>', 'Worktree label to build')
    .action(async (label: string) => {
      try {
        // Check if worktree exists
        const worktree = await getWorktree(label);
        if (!worktree) {
          console.log(error(`Worktree '${label}' not found`));
          process.exit(1);
        }

        // Start build
        console.log(section('Building iOS'));

        const buildSpinner = ora('Building...').start();

        const result = await buildIOS(label);

        buildSpinner.stop();

        if (result.success) {
          console.log(success('iOS build completed successfully!'));
          if (result.duration) {
            console.log(theme.dim(`  Duration: ${Math.round(result.duration)}s`));
          }
        } else {
          console.log(error('iOS build failed'));
          if (result.error) {
            console.log(theme.dim(`  ${result.error}`));
          }
          process.exit(1);
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Android build
  buildCmd
    .command('android')
    .description('Build Android application')
    .argument('<label>', 'Worktree label to build')
    .action(async (label: string) => {
      try {
        // Check if worktree exists
        const worktree = await getWorktree(label);
        if (!worktree) {
          console.log(error(`Worktree '${label}' not found`));
          process.exit(1);
        }

        // Start build
        console.log(section('Building Android'));

        const buildSpinner = ora('Building...').start();

        const result = await buildAndroid(label);

        buildSpinner.stop();

        if (result.success) {
          console.log(success('Android build completed successfully!'));
          if (result.duration) {
            console.log(theme.dim(`  Duration: ${Math.round(result.duration)}s`));
          }
        } else {
          console.log(error('Android build failed'));
          if (result.error) {
            console.log(theme.dim(`  ${result.error}`));
          }
          process.exit(1);
        }
      } catch (err) {
        handleError(err);
      }
    });

  return buildCmd;
}
