# Etz

> Manage git worktrees across multiple related repositories

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

**The Problem:** You work on features that span multiple repositories (iOS, Android, backend, shared libs). Git worktrees let you work on multiple branches simultaneously, but managing them across repos is tedious - creating the same worktree in each repo, tracking status, cleaning up.

**The Solution:** Etz treats multiple repositories as a single logical unit. Create worktrees across all repos with one command, see unified status, and clean up everything at once.

## Quick Example

```bash
# Create worktree "auth-feature" across iOS, Android, and backend repos
etz new auth-feature

# See status across all repos
etz list

# Done? Clean up everything
etz delete auth-feature
```

## What it does

Coordinates worktree operations across multiple independent repositories. Git has `git worktree` for single repos and `git submodule foreach` for submodules, but nothing for managing worktrees across independent repos that happen to be related.

## Features

- Create/delete worktrees across multiple repos at once
- View git status across all repos in a unified list
- CLI for scripting and automation
- Desktop app for visual interface
- Different branch names per repo if needed
- No submodules or git meta-repo required

## Installation

**CLI:** Not yet published to npm. For now, see [Development Setup](#development-setup) to build from source.

**Desktop App:** Download from [releases](https://github.com/etz-dev/etz/releases) (macOS, Windows, Linux).

## Getting Started

### 1. Install

```bash
# CLI (once published to npm)
npm install -g @etz/cli

# Or for development - see Development Setup below
```

### 2. Configure

Create `~/.etzconfig.yaml` pointing to your repos:

```yaml
base_branch: main
worktrees_dir: ~/Developer/worktrees
repos:
  - name: ios
    base_path: ~/repos/myapp-ios
  - name: android
    base_path: ~/repos/myapp-android
  - name: backend
    base_path: ~/repos/myapp-api
```

### 3. Use it

```bash
# Create worktree across all repos
etz new my-feature

# List worktrees and their status
etz list

# Delete when done
etz delete my-feature
```

Run `etz --help` for all commands.

## How it works

Etz wraps `git worktree` commands and coordinates them across multiple repos:

- Reads repo definitions from `.etzconfig.yaml`
- Runs worktree operations in parallel with progress indicators
- Tracks which worktrees belong together across repos (via shared "label")
- Provides helpers: `etz open` for launching editors, `etz doctor` for validation, interactive prompts, etc.

It doesn't reimplement git worktree logic - it coordinates the operations across repos and manages the bookkeeping.

## Common Commands

```bash
etz new <branch>              # Create worktree across all repos
etz new <branch> -r ios       # Create only in specific repo
etz new -i                    # Interactive mode (prompts for options)
etz list                      # Show all worktrees with status
etz delete <branch>           # Remove worktree from all repos
etz open <branch> <repo>      # Open in editor (VS Code, Cursor, etc.)
etz doctor                    # Check configuration health
```

See [CLI Documentation](./packages/cli/README.md) for complete command reference.

## Documentation

- [CLI Reference](./packages/cli/README.md) - All commands and options
- [Desktop App Guide](./packages/desktop/README.md)
- [Core Library API](./packages/core/README.md) - For building on top of Etz

## Architecture

- **@etz/core** - Core library (TypeScript)
- **@etz/cli** - Command-line tool
- **@etz/desktop** - Electron app

## Development Setup

```bash
# Clone the repository
git clone https://github.com/etz-dev/etz.git
cd etz

# Install dependencies
npm install

# Build all packages
npm run build

# Run the CLI in development
npm run cli -- list

# Run the desktop app in development
npm run dev:desktop
```

### Quick Commands

```bash
# Build everything
npm run build

# Build specific package
npm run build:core
npm run build:cli
npm run build:desktop

# Development mode (watch)
npm run dev:core
npm run dev:cli
npm run dev:desktop

# Run tests
npm test
```

## Roadmap

**Current focus (v1.0):**
- Core worktree operations (create, list, delete)
- Multi-repo configuration
- CLI and desktop app

**Potential future additions:**
- Plugin system for custom commands
- Team configuration sharing
- CI/CD integration helpers

Open to feedback on what would be most valuable - see [Discussions](https://github.com/etz-dev/etz/discussions).

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- **Bug reports:** [Open an issue](https://github.com/etz-dev/etz/issues)
- **Feature requests:** [Start a discussion](https://github.com/etz-dev/etz/discussions)
- **Questions:** [Discussions](https://github.com/etz-dev/etz/discussions)

## License

MIT - see [LICENSE](LICENSE) for details.
