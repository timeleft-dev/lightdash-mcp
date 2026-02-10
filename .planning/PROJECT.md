# Lightdash MCP Server

## What This Is

A custom MCP (Model Context Protocol) server for Lightdash, built in TypeScript with stdio transport, designed for use with Claude Desktop. Provides 10 read-only tools for discovering and querying Lightdash data with aggressive server-side field filtering. Replaces the broken `lightdash-mcp-server` npm package.

## Core Value

Clean, filtered Lightdash data access through MCP — every tool returns only the fields Claude needs, never raw API dumps.

## Requirements

### Validated

- ✓ Node.js MCP server using @modelcontextprotocol/sdk with stdio transport — v1.0
- ✓ Zero stdout noise — console.log override, only JSON-RPC on stdout — v1.0
- ✓ Env var config: LIGHTDASH_API_KEY (PAT), LIGHTDASH_API_URL (base URL) — v1.0
- ✓ Auto-append /api/v1 to base URL if not already present — v1.0
- ✓ Auth header: Authorization: ApiKey <token> — v1.0
- ✓ search_charts with server-side case-insensitive filtering (7 fields) — v1.0
- ✓ get_chart — full chart config — v1.0
- ✓ get_chart_results — execute saved chart, return flattened rows — v1.0
- ✓ list_projects — org projects with uuid/name/type — v1.0
- ✓ list_spaces — project spaces with 6 filtered fields — v1.0
- ✓ list_dashboards with optional name filter — v1.0
- ✓ list_explores with error state handling — v1.0
- ✓ get_explore — full explore schema (hidden fields filtered, SQL omitted) — v1.0
- ✓ run_raw_query with native Lightdash filter/sort passthrough — v1.0
- ✓ All API responses unwrap { results: ... } wrapper — v1.0
- ✓ TypeScript source compiled, deployed to ~/lightdash-mcp/ — v1.0
- ✓ Claude Desktop configuration documented — v1.0

- ✓ Public GitHub repo (timeleft-dev/lightdash-mcp) with .gitignore and package metadata — v1.1
- ✓ 248-line beginner-friendly README with install guide, PAT creation, Claude Desktop config, troubleshooting — v1.1
- ✓ Optional preferences guide for CSV output and Recharts chart artifacts — v1.1
- ✓ MIT license — v1.1

### Active

**Current Milestone: v1.2 npm Distribution**

**Goal:** Publish to npm so users install via `npx -y lightdash-mcp` instead of cloning.

**Target features:**
- npm publish with `lightdash-mcp` package name
- package.json metadata (engines/keywords/repository/license/bin/files)
- README rewrite: npx-first, under 200 lines, non-engineer audience
- Verify npx install works end-to-end

### Out of Scope

- OAuth or other auth methods — PAT (ApiKey) only
- Web/SSE transport — stdio only, for Claude Desktop
- Caching layer — keep it simple, direct API calls
- Write operations (create/update/delete charts, dashboards) — read-only for now
- Custom filter abstraction — use native Lightdash filter format pass-through

## Context

Shipped v1.1 with 1,327 LOC TypeScript across 11 source files + 248-line README.
Tech stack: @modelcontextprotocol/sdk v1.26+, zod v3.25+, Node.js 22 LTS (built-in fetch).
10 tools: lightdash_ping, list_projects, list_spaces, search_charts, list_dashboards, list_explores, get_chart, get_chart_results, get_explore, run_raw_query.
Public repo: github.com/timeleft-dev/lightdash-mcp. User confirmed working with Claude Desktop against production Lightdash.

## Constraints

- **Transport**: Stdio only — Claude Desktop connects via stdin/stdout
- **Stdout purity**: Absolutely zero non-JSON-RPC output on stdout; use stderr for logging
- **Response size**: Every tool must filter response fields to minimize payload size
- **Auth**: ApiKey PAT header format required by Lightdash API
- **Query limits**: 500-row truncation on results, 60s timeout on query execution

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over JavaScript | Type safety, better DX with MCP SDK types | ✓ Good |
| Native Lightdash filter format for run_raw_query | No abstraction layer needed, pass-through to API | ✓ Good |
| Source separate from deploy dir | Dev in ~/Documents/Lightdash MCP/, deploy compiled JS to ~/lightdash-mcp/ | ✓ Good |
| Server-side filtering on search_charts | 413K full payload is unusable in Claude context window | ✓ Good |
| ES2022 + Node16 module resolution | Stable ESM with built-in fetch and AbortSignal.timeout | ✓ Good |
| Console.log override inline before imports | Guarantees stdout purity before any module loads | ✓ Good |
| registerXTool(server, client) pattern | Clean per-file tool registration, easy to add new tools | ✓ Good |
| type field instead of warehouseType | warehouseType not on ProjectSummary list endpoint | ✓ Good |
| z.any() for filter passthrough | Native Lightdash format, no leaky abstraction | ✓ Good |
| Row flattening (val?.value?.raw) | Compact LLM-friendly output from nested Lightdash format | ✓ Good |
| git clone install path (no npm publish) | Simple for v1, avoids npm registry complexity | ✓ Good |
| Dual JSON config examples in README | Covers both fresh and existing MCP server setups | ✓ Good |
| Expandable troubleshooting sections | Keeps README clean while covering 6 common issues | ✓ Good |

---
*Last updated: 2026-02-10 after v1.2 milestone start*
