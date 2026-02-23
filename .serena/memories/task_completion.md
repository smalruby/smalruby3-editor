# Task Completion Workflow

Before considering a task complete and preparing a Pull Request:

1. **Verify Functionality**: Ensure changes work as expected and add new tests if applicable.
2. **Run Lint Checks**:
   ```bash
   docker compose run --rm app npm run lint
   ```
3. **Run Unit Tests**:
   ```bash
   docker compose run --rm app npm run test:unit
   ```
4. **Run Integration Tests** (if applicable — requires build:dev first):
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev"
   docker compose run --rm app npm run test:integration
   ```
5. **Build Check**: Ensure the project builds successfully.
   ```bash
   docker compose run --rm app npm run build
   ```
6. **Git Status**: Check for untracked files and ensure all changes are staged.
7. **Commit**: Use Conventional Commits format.

## Ruby ↔ Blocks Testing Guidance

- **Prefer unit tests** for all `ruby-to-blocks-converter/` and `ruby-generator/` logic.
- The VM mock is available; extend it (add methods/state) to cover new cases rather than resorting to integration tests.
- Use **integration tests** only for browser-specific behavior:
  - Tab switching timing (Ruby tab ↔ Blocks tab)
  - Monaco Editor lifecycle (mount, unmount, readiness)
  - UI interactions dependent on actual DOM/browser rendering
