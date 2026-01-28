# Task Completion Workflow

Before considering a task complete and preparing a Pull Request:

1. **Verify Functionality**: Ensure the changes work as expected and add new tests if applicable.
2. **Run Lint Checks**:
   ```bash
   docker compose run --rm app bash -c "npm run lint"
   ```
3. **Run Unit Tests**:
   ```bash
   docker compose run --rm app bash -c "npm run test:unit"
   ```
4. **Run Integration Tests** (if applicable):
   ```bash
   docker compose run --rm app bash -c "npm run test:integration"
   ```
5. **Build Check**: Ensure the project builds successfully.
   ```bash
   docker compose run --rm app bash -c "npm run build"
   ```
6. **Git Status**: Check for untracked files and ensure all changes are staged.
7. **Commit**: Use Conventional Commits.
8. **Submodule Reference** (if applicable): Ensure that if you modified a submodule, the parent repository reference is updated.
