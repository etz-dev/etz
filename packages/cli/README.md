# Etz CLI

Command-line tool for managing git worktrees across multiple repositories.

Part of the [Etz](../../README.md) project.

## Installation

Not yet published to npm. For development:

```bash
cd packages/cli
npm run build
npm link

# Now available globally
etz --help
```

Or run directly:
```bash
node packages/cli/bin/etz.js <command>
```

## Commands

### `etz list`

List all worktrees with their status.

```bash
etz list              # Show all worktrees in a table
etz ls                # Short alias
etz list --json       # Output as JSON
```

**Output includes:**
- Worktree label
- Repository name
- Current branch
- Git status (clean/dirty with change count)

### `etz new`

Create a new worktree (alias: `switch`, `sw`).

```bash
# Basic usage - creates worktree with same branch across all repos
etz new feature-branch

# Custom label
etz new feature-branch -l my-feature

# Different branches per repo
etz new -l my-feature -b ios:feat-ios -b android:feat-android

# Interactive mode - prompts for all options
etz new --interactive
etz new -i

# Only operate on specific repo
etz new feature-branch --repo ios

# Dry run - preview without executing
etz new feature-branch --dry-run

# You can also use the old 'switch' command (alias)
etz switch feature-branch
```

**Options:**
- `-l, --label <label>` - Worktree label (folder name)
- `-r, --repo <repo>` - Only operate on specific repo
- `-d, --default <branch>` - Default branch for all repos
- `-b, --branch <repo:branch>` - Set branch for specific repo (repeatable)
- `--dry-run` - Preview without executing
- `-i, --interactive` - Interactive mode with prompts

### `etz delete`

Delete a worktree (alias: `clean`, `rm`).

```bash
# Basic usage (with confirmation)
etz delete feature-branch

# Skip confirmation
etz delete feature-branch -y

# Only delete specific repo
etz delete feature-branch --repo ios

# Also delete local git branches
etz delete feature-branch --delete-branches

# Force deletion (even if not a git worktree)
etz delete feature-branch --force

# Dry run
etz delete feature-branch --dry-run

# You can also use the old 'clean' command (alias)
etz clean feature-branch
```

**Options:**
- `-r, --repo <repo>` - Only clean specific repo
- `-f, --force` - Force deletion even if not a git worktree
- `--delete-branches` - Also delete local git branches
- `--dry-run` - Preview without executing
- `-y, --yes` - Skip confirmation prompt

### `etz doctor`

Check environment health and configuration.

```bash
etz doctor
```

**Checks:**
- Configuration file exists and is valid
- Worktrees directory exists or can be created
- All configured repositories exist and are valid git repos

### `etz open`

Open a worktree in your editor.

```bash
# Open specific repo
etz open feature-branch ios

# Specify editor
etz open feature-branch ios --editor cursor

# Interactive mode
etz open feature-branch --interactive
```

**Supported Editors:**
- `code` - Visual Studio Code
- `cursor` - Cursor
- `vim` - Vim
- `nvim` - Neovim
- `idea` - IntelliJ IDEA
- `webstorm` - WebStorm
- `xcode` - Xcode

**Options:**
- `-e, --editor <editor>` - Editor to use
- `-i, --interactive` - Prompt for repo and editor selection

### `etz branches`

List all branches for a repository.

```bash
# List branches for a repo
etz branches ios

# Interactive mode - prompts for repo
etz branches --interactive
etz br -i

# JSON output
etz branches ios --json
```

### `etz build`

Build iOS or Android applications.

```bash
# Build iOS
etz build ios feature-branch

# Build Android
etz build android feature-branch
```

## Configuration

Create a `.etzconfig.yaml` file in your home directory or current directory:

```yaml
base_branch: master
worktrees_dir: ~/Developer/worktrees

repos:
  - name: project.ios
    base_path: ~/Developer/repos/project.ios
  - name: project.android
    base_path: ~/Developer/repos/project.android
  - name: project.shared
    base_path: ~/Developer/repos/project.shared
```

## Interactive Mode

Add `-i` to get prompts instead of arguments:

```bash
etz new -i          # Prompts for branch name, label, repos
etz open my-feature -i   # Prompts for repo and editor
etz branches -i     # Prompts for repo
```

## Examples

### Create a feature worktree

```bash
# Same branch across all repos
etz new feature/auth-improvements

# Different branches per repo
etz new -l auth-feature \\
  -b ios:feature/ios-auth \\
  -b android:feature/android-auth \\
  -b shared:feature/shared-auth
```

### Work with a worktree

```bash
# List all worktrees
etz list

# Open in VS Code
etz open auth-feature ios

# Build iOS app
etz build ios auth-feature
```

### Clean up

```bash
# Delete worktree (with confirmation)
etz delete auth-feature

# Delete and remove local branches
etz delete auth-feature --delete-branches -y
```

## Output Formats

Default output is colored with status indicators. Add `--json` for machine-readable output:

```bash
etz list --json
etz branches ios --json
```

## Tips

- Aliases: `ls` for list, `sw` for new, `rm` for delete, `br` for branches
- Use `--dry-run` to preview operations
- Use `-i` for interactive mode with prompts
- Run `etz doctor` if something isn't working

## Development

### Project Structure

```
packages/etz-cli/
├── src/
│   ├── commands/       # Command implementations
│   │   ├── list.ts
│   │   ├── switch.ts
│   │   ├── clean.ts
│   │   ├── doctor.ts
│   │   ├── open.ts
│   │   ├── build.ts
│   │   └── branches.ts
│   ├── ui/            # UI utilities
│   │   ├── theme.ts   # Colors and styling
│   │   ├── formatters.ts  # Output formatting
│   │   └── prompts.ts # Interactive prompts
│   ├── utils/
│   │   └── errors.ts  # Error handling
│   └── index.ts       # CLI entry point
├── bin/
│   └── etz.js         # Executable
└── package.json
```

## License

MIT - see [LICENSE](../../LICENSE)
