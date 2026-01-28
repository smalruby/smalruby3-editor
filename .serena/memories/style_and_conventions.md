# Development Styles and Conventions

## Commit Messages
- Enforce **Conventional Commits** (e.g., `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `style:`, `test:`, `perf:`, `build:`, `ci:`, `revert:`).
- Use a descriptive body if the change is non-trivial.

## Branching Strategy
- Default branch is `develop`.
- **Never commit directly to `develop`**.
- Create feature branches from `develop` (e.g., `fix/issue-description`, `feature/new-functionality`).
- Pull requests should target the `develop` branch.

## Linting and Formatting
- **JavaScript/TypeScript**: Uses ESLint.
- Linting must pass before committing (`npm run lint`).
- Mimic existing code patterns and conventions in each package.

## GitHub Operations
- Use the `gh` command for GitHub access.
- All operations (issues, PRs) must be performed against the **Smalruby organization** repositories, not upstream Scratch Foundation.
- For `gh` command messages, use a temporary file and `-F` flag to avoid escaping issues.
