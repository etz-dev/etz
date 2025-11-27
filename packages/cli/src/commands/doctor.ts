import { Command } from 'commander';
import { doctor } from '@etz/core';
import { theme, success, error, warning, section } from '../ui/theme.js';
import { handleError } from '../utils/errors.js';

export function createDoctorCommand(): Command {
  const command = new Command('doctor')
    .description('Check etz environment health')
    .action(async () => {
      try {
        console.log(section('Environment Health Check'));

        const result = await doctor();

        // Display all checks
        for (const check of result.checks) {
          if (check.status === 'pass') {
            console.log(success(check.name));
            console.log('  ' + theme.dim(check.message));
          } else if (check.status === 'warning') {
            console.log(warning(check.name));
            console.log('  ' + theme.dim(check.message));
          } else {
            console.log(error(check.name));
            console.log('  ' + theme.dim(check.message));
          }
          console.log();
        }

        // Overall status
        console.log(theme.bold('Overall Status'));
        if (result.success) {
          console.log(success('All checks passed! Ready to use etz.'));
        } else {
          console.log(error('Some checks failed. Please fix the issues above.'));
          process.exit(1);
        }
      } catch (err) {
        handleError(err);
      }
    });

  return command;
}
