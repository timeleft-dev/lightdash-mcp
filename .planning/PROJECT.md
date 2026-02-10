# Lightdash MCP Server

## What This Is

A custom MCP (Model Context Protocol) server for Lightdash, built in TypeScript with stdio transport, designed for use with Claude Desktop. It replaces the broken `lightdash-mcp-server` npm package, which pollutes stdout with non-JSON-RPC output and returns massive unfiltered API payloads (413K+) that blow Claude's context window.

## Core Value

Clean, filtered Lightdash data access through MCP — every tool returns only the fields Claude needs, never raw API dumps.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Node.js MCP server using @modelcontextprotocol/sdk with stdio transport
- [ ] Zero stdout noise — no console.log, only JSON-RPC on stdout
- [ ] Env var config: LIGHTDASH_API_KEY (PAT), LIGHTDASH_API_URL (base URL)
- [ ] Auto-append /api/v1 to base URL if not already present
- [ ] Auth header: Authorization: ApiKey <token>
- [ ] search_charts(projectUuid, query) — GET charts list, server-side case-insensitive name filter, return only uuid/name/spaceName/chartType/chartKind/updatedAt/slug
- [ ] get_chart(chartUuid) — GET full chart config
- [ ] get_chart_results(chartUuid) — POST chart results, return query rows
- [ ] list_projects() — GET org projects, return name/uuid/warehouseType only
- [ ] list_spaces(projectUuid) — GET project spaces
- [ ] list_dashboards(projectUuid, query?) — GET dashboards with optional name filter, return summary only
- [ ] list_explores(projectUuid) — GET explores, return name/label/description/tags only
- [ ] get_explore(projectUuid, exploreName) — GET full explore schema
- [ ] run_raw_query(projectUuid, exploreName, dimensions, metrics, filters?, sorts?, limit?) — POST runQuery with native Lightdash filter/sort format
- [ ] All API responses unwrap { results: ... } wrapper
- [ ] TypeScript source in ~/Documents/Lightdash MCP/, compiled output deployed to ~/lightdash-mcp/
- [ ] Claude Desktop configuration for the server

### Out of Scope

- OAuth or other auth methods — PAT (ApiKey) only
- Web/SSE transport — stdio only, for Claude Desktop
- Caching layer — keep it simple, direct API calls
- Write operations (create/update/delete charts, dashboards) — read-only for now
- Custom filter abstraction — use native Lightdash filter format pass-through

## Context

- The existing `lightdash-mcp-server` npm package has two critical bugs: stdout pollution (console.log mixed with JSON-RPC) and returning full unfiltered API payloads
- Lightdash API wraps all responses in `{ results: ... }` — every tool must unwrap this
- The chart list endpoint returns ~413K of data; server-side filtering before returning to Claude is essential
- Target Lightdash instance: self-hosted at a custom URL (not cloud.lightdash.com)
- MCP SDK provides Server class and stdio transport out of the box

## Constraints

- **Transport**: Stdio only — Claude Desktop connects via stdin/stdout
- **Stdout purity**: Absolutely zero non-JSON-RPC output on stdout; use stderr for logging if needed
- **Response size**: Every tool must filter response fields to minimize payload size
- **Auth**: ApiKey PAT header format required by Lightdash API

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over JavaScript | Type safety, better DX with MCP SDK types | — Pending |
| Native Lightdash filter format for run_raw_query | No abstraction layer needed, pass-through to API | — Pending |
| Source separate from deploy dir | Dev in ~/Documents/Lightdash MCP/, deploy compiled JS to ~/lightdash-mcp/ | — Pending |
| Server-side filtering on search_charts | 413K full payload is unusable in Claude context window | — Pending |

---
*Last updated: 2026-02-10 after initialization*
