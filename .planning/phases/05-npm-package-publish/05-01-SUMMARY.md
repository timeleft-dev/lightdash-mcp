---
phase: 05-npm-package-publish
plan: 01
subsystem: infra
tags: [npm, npx, package-publish, mcp, distribution]

# Dependency graph
requires:
  - phase: 04-github-publication-readme
    provides: "GitHub repository with README, LICENSE, and complete source code"
provides:
  - "lightdash-mcp@1.0.0 published to npm registry"
  - "npx -y lightdash-mcp installable globally"
  - "package.json with engines, bin, files, keywords, repository fields"
affects: [06-readme-rewrite-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["npm bin field pointing to build/index.js for CLI execution"]

key-files:
  created: []
  modified: [package.json]

key-decisions:
  - "Node.js >=18 engine requirement (minimum for built-in fetch and stable ESM)"
  - "Published as unscoped public package: lightdash-mcp"

patterns-established:
  - "npm publish workflow: build -> pack dry-run -> publish --access public"

# Metrics
duration: 1min
completed: 2026-02-10
---

# Phase 5 Plan 1: npm Package Publish Summary

**lightdash-mcp@1.0.0 published to npm with engines >=18, bin entry, and public access**

## Performance

- **Duration:** 1 min (Task 1 automated, Tasks 2-3 manual by user, verification automated)
- **Started:** 2026-02-10T23:10:32Z
- **Completed:** 2026-02-10T23:10:48Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Added `engines` field to package.json requiring Node.js >= 18
- Package published to npm as `lightdash-mcp@1.0.0` with public access
- Verified package is live: `npm info lightdash-mcp` returns correct metadata, version, and bin entry
- Package installable via `npx -y lightdash-mcp` for zero-config Claude Desktop integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add engines field and rebuild** - `3e946c5` (chore)
2. **Task 2: npm login** - manual (human-action checkpoint, user authenticated)
3. **Task 3: Publish to npm and verify** - manual (user ran `npm publish --access public` with 2FA)

## Files Created/Modified
- `package.json` - Added engines field `{ "node": ">=18" }`

## Decisions Made
- Node.js >= 18 engine requirement chosen because project uses built-in fetch and stable ESM support
- Published as unscoped public package (`lightdash-mcp`) for simplest possible npx invocation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Authentication gate (expected): npm login required interactive browser-based 2FA authentication. User completed this manually as planned via checkpoint:human-action. No unexpected issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Package is live on npm, ready for Phase 6 (README rewrite and verification)
- README can now reference `npx -y lightdash-mcp` as the installation method
- npm package URL: https://www.npmjs.com/package/lightdash-mcp

## Self-Check: PASSED

- FOUND: package.json
- FOUND: build/index.js
- FOUND: 05-01-SUMMARY.md
- FOUND: commit 3e946c5
- FOUND: npm lightdash-mcp@1.0.0

---
*Phase: 05-npm-package-publish*
*Completed: 2026-02-10*
