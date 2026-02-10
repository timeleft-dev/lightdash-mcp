---
phase: 03-data-access-deployment
plan: 03
subsystem: infra
tags: [lightdash, mcp, deploy, build, shell-script, claude-desktop]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: TypeScript build configuration (tsconfig.json), package.json scripts
  - phase: 02-discovery-tools
    provides: Discovery tool implementations compiled by npm run build
  - phase: 03-data-access-deployment
    plan: 02
    provides: All 10 MCP tools registered and compiling cleanly
provides:
  - deploy.sh script that builds TypeScript and deploys production artifacts to ~/lightdash-mcp/
  - Deployed MCP server ready for Claude Desktop integration
  - Claude Desktop configuration JSON with correct paths
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [bash deploy script with production-only npm ci, $HOME for path safety, heredoc config output]

key-files:
  created: [deploy.sh]
  modified: []

key-decisions:
  - "No new decisions needed -- followed plan as specified"

patterns-established:
  - "Deploy script uses $HOME not ~ for reliable path expansion in non-interactive shells"
  - "npm ci --omit=dev for production-only node_modules, followed by npm ci to restore devDependencies"
  - "Unquoted heredoc delimiter (CONFIG) so $DEPLOY_DIR expands to real path in output"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 3 Plan 3: Deploy Script & Claude Desktop Integration Summary

**deploy.sh builds TypeScript, copies production artifacts to ~/lightdash-mcp/, and prints Claude Desktop config with expanded path**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T19:35:00Z
- **Completed:** 2026-02-10T19:38:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- deploy.sh created: builds TypeScript, installs production-only dependencies, deploys build + node_modules + package.json to ~/lightdash-mcp/
- Deployed server at ~/lightdash-mcp/build/index.js validated -- starts correctly, validates LIGHTDASH_API_KEY and LIGHTDASH_API_URL env vars
- Claude Desktop config JSON printed with real expanded $HOME path, ready to paste into claude_desktop_config.json
- Source project devDependencies automatically restored after deploy via npm ci

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deploy.sh build and deployment script** - `894cef8` (feat)
2. **Task 2: Verify end-to-end deployment and Claude Desktop readiness** - checkpoint:human-verify (approved)

## Files Created/Modified
- `deploy.sh` - Shell script that builds TypeScript, deploys production artifacts to ~/lightdash-mcp/, prints Claude Desktop config

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
To use the MCP server with Claude Desktop:
1. Run `./deploy.sh` from the project root
2. Add the printed JSON config to `~/Library/Application Support/Claude/claude_desktop_config.json`
3. Replace `your-lightdash-personal-access-token` with your Lightdash personal access token
4. Replace `https://your-lightdash-instance.com` with your Lightdash instance URL
5. Restart Claude Desktop

## Next Phase Readiness
- All 3 phases complete -- project is fully functional
- 10 MCP tools available: ping, list_projects, list_spaces, search_charts, list_dashboards, list_explores, get_chart, get_chart_results, get_explore, run_raw_query
- Server deployed and ready for Claude Desktop integration

## Self-Check: PASSED

- deploy.sh verified present on disk and executable
- ~/lightdash-mcp/build/index.js verified present on disk
- ~/lightdash-mcp/package.json verified present on disk
- ~/lightdash-mcp/node_modules/ verified present on disk
- SUMMARY.md verified present on disk
- Task 1 commit (894cef8) verified in git log

---
*Phase: 03-data-access-deployment*
*Completed: 2026-02-10*
