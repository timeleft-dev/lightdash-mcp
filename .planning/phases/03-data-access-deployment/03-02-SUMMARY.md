---
phase: 03-data-access-deployment
plan: 02
subsystem: api
tags: [lightdash, mcp, explore-schema, ad-hoc-query, data-access, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: LightdashClient HTTP client, wrapToolHandler, types.ts structure
  - phase: 02-discovery-tools
    provides: registerSearchChartsTool pattern, tool registration conventions
  - phase: 03-data-access-deployment
    plan: 01
    provides: Phase 3 type interfaces (ExploreResponse, QueryResultsResponse, CompiledTableResponse, CompiledFieldResponse), row flattening pattern
provides:
  - lightdash_get_explore tool for inspecting explore schemas with visible-only field filtering
  - lightdash_run_raw_query tool for ad-hoc metric queries with native Lightdash filter passthrough
  - All 10 tools registered in index.ts (complete MCP server tool set)
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [native filter passthrough via z.any(), explore schema filtering with hidden field exclusion and SQL omission, encodeURIComponent on explore names]

key-files:
  created: [src/tools/query.ts]
  modified: [src/tools/explores.ts, src/index.ts]

key-decisions:
  - "No new decisions needed -- followed established tool registration patterns from Phase 2 and 03-01"

patterns-established:
  - "Native filter passthrough: z.any().optional() for Lightdash filter objects, passed through as-is"
  - "Explore schema filtering: hidden fields excluded, SQL internals (sql, compiledSql, sqlOn) omitted from response"
  - "encodeURIComponent on user-provided path segments for URL safety"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 3 Plan 2: Explore Schema & Ad-hoc Query Tools Summary

**lightdash_get_explore for schema discovery with visible-only field filtering, and lightdash_run_raw_query for ad-hoc metric queries with native Lightdash filter passthrough**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T19:30:52Z
- **Completed:** 2026-02-10T19:32:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- lightdash_get_explore tool returns explore schema with tables, visible dimensions/metrics (name, label, type, description only), and joins (table, type, relationship only) -- hidden fields excluded, SQL internals omitted
- lightdash_run_raw_query tool executes ad-hoc queries with native Lightdash filter passthrough (z.any()), 60s timeout, 500-row truncation with metadata, limit clamped to 5000, tableCalculations defaulted to []
- All 10 tools registered in index.ts -- MCP server has complete tool set (6 discovery + 4 data access)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement lightdash_get_explore tool in explores.ts** - `cc1d86a` (feat)
2. **Task 2: Implement lightdash_run_raw_query and register all 10 tools** - `6129296` (feat)

## Files Created/Modified
- `src/tools/explores.ts` - Added registerGetExploreTool alongside existing registerListExploresTool; imports ExploreResponse, CompiledTableResponse, CompiledFieldResponse
- `src/tools/query.ts` - New file with registerRunRawQueryTool: native filter passthrough, row flattening, 60s timeout, 500-row truncation
- `src/index.ts` - Imports and registers all 4 new Phase 3 tools (getChart, getChartResults, getExplore, runRawQuery) for 10 total

## Decisions Made
None - followed plan as specified. Reused established patterns from Phase 2 and 03-01 tool implementations.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 10 MCP tools registered and compiling cleanly
- Full data access workflow available: list explores -> get explore schema -> run ad-hoc query
- Ready for Plan 03-03 (deployment/build configuration)

## Self-Check: PASSED

- All 3 source files verified present on disk (explores.ts, query.ts, index.ts)
- SUMMARY.md verified present on disk
- Both task commits (cc1d86a, 6129296) verified in git log

---
*Phase: 03-data-access-deployment*
*Completed: 2026-02-10*
