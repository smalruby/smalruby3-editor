#!/usr/bin/env bash
#
# Start the Playwright MCP server ON THE HOST (macOS) so that Claude Code running
# inside the devpod container can drive the real host Chrome headful.
#
# Run this on the HOST in iTerm2 (NOT inside the container). The container talks to
# it over http://host.docker.internal:8931/mcp.
#
# After it is up, inside the container point the local MCP scope at it once:
#   claude mcp add --scope local --transport http playwright http://host.docker.internal:8931/mcp
# then run /mcp in Claude Code to reconnect.
#
# Notes / gotchas (see memory: host-playwright-mcp-headful):
#   --host 0.0.0.0     : REQUIRED. Without it @playwright/mcp binds localhost only and
#                        the container cannot reach it (curl -> connection refused).
#   --allowed-hosts    : MUST be one comma-separated arg WITH ports. Space-separated
#                        values silently keep only the last one. Host-header allowlist
#                        (NOT the bind address — that's --host).
#   --output-dir       : point at the worktree tmp/ so screenshots land in /app/tmp/
#                        inside the container and are Read-able there.
#   --user-data-dir    : persistent profile so Google login survives across restarts.
set -euo pipefail

PORT="${PORT:-8931}"
# Repo root = parent of this script's tools/ dir. Resolve so it works from any CWD.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/tmp}"
USER_DATA_DIR="${USER_DATA_DIR:-$HOME/.cache/smalruby-playwright-profile}"

mkdir -p "$OUTPUT_DIR"

exec npx @playwright/mcp@latest \
  --host 0.0.0.0 \
  --port "$PORT" \
  --allowed-hosts "host.docker.internal:${PORT},localhost:${PORT},localhost" \
  --browser chrome \
  --user-data-dir "$USER_DATA_DIR" \
  --output-dir "$OUTPUT_DIR"
