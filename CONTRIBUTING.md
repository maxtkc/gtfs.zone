# Contributing to gtfs.zone

## Commit Message Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to automate versioning and changelog generation.

### Using Commitizen

Instead of `git commit`, use:

```bash
npm run commit
```

This will prompt you to fill out the commit message following the conventional format.

### Commit Message Format

Each commit message consists of a **type**, an optional **scope**, and a **subject**:

```
<type>(<scope>): <subject>
```

#### Types

- `feat`: A new feature (triggers minor version bump)
- `fix`: A bug fix (triggers patch version bump)
- `docs`: Documentation only changes
- `style`: Changes that don't affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A performance improvement
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

#### Breaking Changes

Add `BREAKING CHANGE:` in the commit body or add `!` after the type/scope to trigger a major version bump:

```bash
feat!: remove support for old API
```

### Examples

```bash
feat(stop-view): add trip creation button
fix(gtfs-parser): handle null arrival times correctly
docs: update installation instructions
refactor(utils): simplify field component logic
```

## Versioning

This project uses **git tags** as the source of truth for versioning, with automatic version injection at build time.

### How It Works

- **package.json version**: Always stays at `0.0.0-development` (never conflicts!)
- **Actual version**: Determined from git tags and commits using `git-describe`
- **Version format**:
  - On a tag: `0.0.18`
  - Between tags: `0.0.18-12-ga1b2c3d` (12 commits since tag, hash a1b2c3d)
  - No tags: `0.0.0-dev.a1b2c3d` (development with hash)

### Creating Releases

When you're ready to release, create a git tag:

```bash
# For the next version
git tag v0.0.19
git push origin v0.0.19
```

This approach means:
- ✅ Every build has a unique, identifiable version
- ✅ No package.json merge conflicts ever
- ✅ No manual version bumping in code
- ✅ Easy to identify exactly which commit produced a build

### Checking Version

```bash
npm run version
```

This will output the current version based on git history.

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Commit using `npm run commit` (this ensures proper commit format)
4. Push your branch and create a pull request
5. After merge to `main`, create a git tag for releases when ready

## Git Hooks

This project uses Husky to enforce quality standards:

- **pre-commit**: Runs linting and formatting on staged files
- **commit-msg**: Validates commit message format using commitlint

If your commit message doesn't follow the conventional format, the commit will be rejected with a helpful error message.
