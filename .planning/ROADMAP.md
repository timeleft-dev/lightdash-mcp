# Roadmap: Lightdash MCP Server

## Overview

Build a TypeScript MCP server that gives Claude Desktop clean, filtered access to a self-hosted Lightdash instance via stdio transport. Phase 1 establishes the foundation (stdout purity, API client, error handling, response filtering). Phase 2 adds 5 discovery tools so Claude can navigate projects, spaces, charts, dashboards, and explores. Phase 3 adds 4 data access tools for chart retrieval and ad-hoc queries, then deploys the compiled server for Claude Desktop use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Stdio Infrastructure** - API client, transport, error handling, response filtering -- no tools yet
- [ ] **Phase 2: Discovery Tools** - 5 tools for navigating Lightdash projects, charts, dashboards, spaces, explores
- [ ] **Phase 3: Data Access & Deployment** - 4 tools for chart data, explore schemas, ad-hoc queries, plus build and deploy

## Phase Details

### Phase 1: Foundation & Stdio Infrastructure
**Goal**: A working MCP server skeleton that connects to Lightdash with zero stdout noise, proper auth, response unwrapping, field filtering, error sanitization, and timeouts -- ready for tools to be plugged in.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-10, INFRA-11, BLDP-01
**Success Criteria** (what must be TRUE):
  1. Server starts via stdio transport and produces zero non-JSON-RPC output on stdout (verified by piping output through jq)
  2. Server reads LIGHTDASH_API_KEY and LIGHTDASH_API_URL from env vars and fails fast with a clear stderr message if either is missing
  3. API client successfully authenticates to Lightdash (ApiKey header), auto-appends /api/v1 to base URL, unwraps { results } envelope, and respects timeouts (30s default, 60s for queries)
  4. A test tool response demonstrates server-side field filtering (raw payload reduced to essential fields only) and tools use lightdash_ prefix with readOnlyHint: true annotation
  5. Errors returned to Claude include isError: true with actionable hints, never exposing API keys, internal URLs, or stack traces
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Discovery Tools
**Goal**: Claude can discover and navigate everything in Lightdash -- projects, spaces, charts, dashboards, and explores -- through 5 filtered MCP tools.
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05
**Success Criteria** (what must be TRUE):
  1. User can call lightdash_list_projects and receive only name, uuid, and warehouseType per project
  2. User can call lightdash_search_charts(projectUuid, query) with a search term and receive case-insensitive matches with only uuid, name, spaceName, chartType, chartKind, updatedAt, slug per result (server-side filter reduces 413KB payload to compact response)
  3. User can call lightdash_list_spaces, lightdash_list_dashboards, and lightdash_list_explores to browse project contents with filtered summary responses
  4. All 5 discovery tools are callable via MCP Inspector and each response stays compact (no raw API dumps)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Data Access & Deployment
**Goal**: Claude can retrieve chart configs, execute saved charts, inspect explore schemas, run ad-hoc queries against Lightdash, and the server is compiled and deployed for Claude Desktop use.
**Depends on**: Phase 2
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, BLDP-02, BLDP-03
**Success Criteria** (what must be TRUE):
  1. User can call lightdash_get_chart(chartUuid) to retrieve full chart configuration and lightdash_get_chart_results(chartUuid) to execute a saved chart and receive query result rows
  2. User can call lightdash_get_explore(projectUuid, exploreName) to retrieve the full explore schema (dimensions, metrics, joins) for constructing queries
  3. User can call lightdash_run_raw_query with dimensions, metrics, and optional native Lightdash filters/sorts/limit to execute ad-hoc queries and receive result rows
  4. TypeScript source compiles to build/ directory and a deploy script copies compiled output plus dependencies to ~/lightdash-mcp/
  5. Claude Desktop can be configured with the server and a full discovery-to-query workflow works end-to-end (list projects -> search charts -> get results; or list explores -> get explore -> run raw query)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Stdio Infrastructure | 0/TBD | Not started | - |
| 2. Discovery Tools | 0/TBD | Not started | - |
| 3. Data Access & Deployment | 0/TBD | Not started | - |
