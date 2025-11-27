# Contributing to Etz

Thank you for your interest in contributing to Etz! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and professional. We're all here to build great tools together.

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in [Issues](https://github.com/etz-dev/etz/issues)
- Use the bug report template
- Include detailed steps to reproduce
- Include your environment (OS, Node version, etc.)

### Suggesting Features

- Check if the feature has already been suggested
- Use the feature request template
- Explain the use case and benefits
- Consider if it fits Etz's scope and philosophy

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Ensure all tests pass (`npm test`)
6. Commit with clear messages
7. Push to your fork
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm 9+
- Git

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/etz.git
cd etz

# Add upstream remote
git remote add upstream https://github.com/etz-dev/etz.git

# Install dependencies
npm install

# Build all packages
npm run build
```

### Project Structure

```
etz/
├── packages/
│   ├── core/          # Core library (@etz/core)
│   ├── cli/           # CLI tool (@etz/cli)
│   └── desktop/       # Desktop app (@etz/desktop)
├── docs/              # Documentation
└── .github/           # CI/CD workflows
```

### Development Workflow

```bash
# Work on core library
npm run dev:core

# Work on CLI
npm run dev:cli

# Work on desktop app
npm run dev:desktop

# Run CLI in development
npm run cli -- list

# Run tests
npm test

# Build everything
npm run build
```

### Making Changes

#### For Core Library

```bash
cd packages/core
# Make your changes to src/
npm run build
npm test
```

#### For CLI

```bash
cd packages/cli
# Make your changes to src/
npm run build
npm run cli -- <command>  # Test your changes
```

#### For Desktop App

```bash
cd packages/desktop
# Make your changes to src/
npm run dev  # Live reload
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Prefer interfaces over types for public APIs
- Add JSDoc comments for public APIs
- Enable strict mode

### Style Guide

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Use trailing commas
- Max line length: 100 characters

### Git Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add ability to parse config from multiple sources
fix: resolve issue with branch detection
docs: update CLI documentation
chore: bump dependencies
test: add tests for worktree creation
```

### Testing

- Write tests for new features
- Maintain or improve code coverage
- Test edge cases
- Run full test suite before submitting PR

## Pull Request Process

1. **Update Documentation** - Update README, docs, or inline comments as needed
2. **Add Tests** - Ensure new features have test coverage
3. **Update Changelog** - Add entry to CHANGELOG.md (if exists)
4. **Pass CI** - All checks must pass
5. **Review Process** - Be responsive to feedback
6. **Squash Commits** - We'll squash on merge

### PR Checklist

- [ ] Code follows the style guide
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No unrelated changes included

## Release Process

Releases are handled by maintainers:

1. Version bump (semantic versioning)
2. Update CHANGELOG
3. Create git tag
4. Publish to npm
5. Create GitHub release
6. Build desktop app binaries

## Questions?

- Open a [Discussion](https://github.com/etz-dev/etz/discussions) for general questions
- Open an [Issue](https://github.com/etz-dev/etz/issues) for bugs or feature requests
- Check existing docs and issues first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Etz! 🌳
