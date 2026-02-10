---
phase: 01-foundation-stdio-infrastructure
plan: 01
subsystem: infra
tags: [typescript, esm, mcp-sdk, zod, stderr-logging, error-handling]

# Dependency graph
requires: []
provides:
  - "ESM project scaffold (package.json, tsconfig.json) with MCP SDK and zod"
  - "Stderr-only logger with stdout guard for stdio transport safety"
  - "LightdashApiError class with safe message extraction from API responses"
  - "Error sanitization (strips API keys, URLs, stack traces)"
  - "wrapToolHandler utility converting exceptions to isError results"
  - "LightdashApiResponse<T> and LightdashProject TypeScript interfaces"
affects: [01-02, 01-03, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: ["@modelcontextprotocol/sdk@1.26.0", "zod@3.25.76", "typescript@5.9.3", "@types/node@22.19.11"]
  patterns: ["ESM with .js import extensions", "stderr-only logging", "error sanitization before LLM exposure", "wrapToolHandler pattern for tool callbacks"]

key-files:
  created: ["package.json", "tsconfig.json", "src/logger.ts", "src/errors.ts", "src/types.ts"]
  modified: []

key-decisions:
  - "Node16 module/moduleResolution (not NodeNext) per research for stable ESM"
  - "ES2022 target for stable built-in fetch and AbortSignal.timeout"
  - "console.log override redirects to stderr with [redirected] prefix for stdout safety"

patterns-established:
  - "All imports use .js extension (ESM requirement)"
  - "All logging goes through log object or console.error, never console.log"
  - "Tool errors caught by wrapToolHandler, returned as isError: true with sanitized message"
  - "API errors parsed to extract safe message, full details logged to stderr only"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 1 Plan 1: Project Scaffolding Summary

**ESM TypeScript project with MCP SDK, stderr-only logger with stdout guard, error sanitization, and wrapToolHandler utility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T17:58:20Z
- **Completed:** 2026-02-10T18:00:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Project scaffolded with ESM config, all 4 dependencies installed (2 runtime, 2 dev)
- Stdout guard prevents console.log from corrupting MCP stdio transport
- Error sanitization strips API keys, URLs, and stack traces before exposing to LLM
- wrapToolHandler converts thrown exceptions into isError: true format for proper MCP error reporting

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project with package.json, tsconfig.json, and install dependencies** - `8a44a7c` (chore)
2. **Task 2: Create logger.ts, errors.ts, and types.ts foundation modules** - `2bc0edf` (feat)

## Files Created/Modified
- `package.json` - Project manifest with ESM config, MCP SDK and zod dependencies, build/start/inspect scripts
- `tsconfig.json` - TypeScript config targeting ES2022 with Node16 module resolution, strict mode
- `src/logger.ts` - setupStdoutGuard() redirects console.log to stderr; log object with info/warn/error/debug
- `src/errors.ts` - LightdashApiError class, sanitizeErrorMessage, formatErrorForLLM, wrapToolHandler
- `src/types.ts` - LightdashApiResponse<T> envelope type, LightdashProject interface

## Decisions Made
- Used Node16 module/moduleResolution (not NodeNext) per research recommendation for stable ESM behavior
- ES2022 target chosen for stable built-in fetch and AbortSignal.timeout support
- console.log override uses [redirected] prefix tag for easy identification in stderr logs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation modules ready for import by client.ts (Plan 01-02) and index.ts (Plan 01-03)
- All exports verified at runtime: logger (setupStdoutGuard, log), errors (LightdashApiError, formatErrorForLLM, sanitizeErrorMessage, wrapToolHandler), types (interfaces)
- TypeScript compiles with zero errors

## Self-Check: PASSED

All files verified present: package.json, tsconfig.json, src/logger.ts, src/errors.ts, src/types.ts, 01-01-SUMMARY.md
All commits verified: 8a44a7c (Task 1), 2bc0edf (Task 2)

---
*Phase: 01-foundation-stdio-infrastructure*
*Completed: 2026-02-10*
