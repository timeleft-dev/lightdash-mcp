# Project Research Summary

**Project:** Lightdash MCP Server
**Domain:** MCP Server wrapping Lightdash REST API (TypeScript, stdio transport)
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

This project replaces a broken existing MCP server (`@lightdash/mcp`) that has two critical bugs: stdout pollution breaking the JSON-RPC protocol, and 413KB unfiltered API responses that overwhelm Claude's context window. The research confirms that building a TypeScript MCP server wrapping the Lightdash REST API is straightforward using the official `@modelcontextprotocol/sdk` v1.x, with Node.js 22 LTS and minimal dependencies (4 packages total). The key to success is aggressive server-side response filtering and strict stdout discipline.

The recommended approach is a 9-tool server organized around user intents rather than 1:1 REST endpoint mapping. Each tool must filter responses to essential fields only, use stderr-only logging, and return errors as content (not protocol errors) so Claude can self-correct. The architecture follows a simple three-layer pattern: transport (stdio) -> protocol (MCP SDK) -> tools -> API client. Research identified 6 critical pitfalls that the existing package fell into, all preventable in Phase 1.

The primary risk is repeating the existing package's mistakes: returning massive unfiltered payloads and polluting stdout. Mitigation is straightforward: implement response size budgeting (4KB max per tool), server-side filtering for all list endpoints, and stdout guards at process startup. The stack is mature and well-documented (HIGH confidence), but query execution tooling will require careful filter format handling (test-driven development recommended).

## Key Findings

### Recommended Stack

The official MCP TypeScript SDK v1.x is production-ready and provides everything needed for stdio transport. Node.js 22 LTS is the conservative choice for stability. TypeScript 5.9 with strict mode catches type errors. No HTTP frameworks, no heavy dependencies—just 4 packages total.

**Core technologies:**
- **Node.js 22.x LTS**: Runtime environment with stable built-in fetch and long support window (until April 2027)
- **TypeScript 5.9.x**: Type safety for MCP SDK types, Zod schemas, and Lightdash API response shaping
- **@modelcontextprotocol/sdk 1.26.x**: Official MCP framework providing McpServer and StdioServerTransport out of the box
- **Zod 3.25.x**: Schema validation (peer dependency of SDK); use v3 not v4 to match official quickstart

**Critical configuration:**
- Package.json must have `"type": "module"` (SDK is ESM-only)
- tsconfig must use `"module": "Node16"` and `"target": "ES2022"`
- Import paths must include `.js` extensions in TypeScript source (ESM requirement)
- Shebang `#!/usr/bin/env node` at top of entry point if using npm bin field

**What NOT to use:**
- Express/Hono (no HTTP needed for stdio)
- console.log anywhere (corrupts stdout)
- axios/node-fetch (built-in fetch is sufficient)
- dotenv (Claude Desktop passes env vars directly)
- OpenAPI code generation (overkill for 9 filtered endpoints)

### Expected Features

Research analyzed two existing Lightdash MCP implementations and multiple BI MCP servers (Metabase, GoodData, Power BI). The pattern is clear: 9 core tools organized by user intent, not REST endpoints.

**Must have (table stakes):**
- Project listing (entry point for all operations)
- Space listing (organizational navigation)
- Chart search with server-side filtering (the #1 broken thing in existing package)
- Chart detail and results retrieval (actual data access)
- Dashboard listing (second core content type)
- Explore listing and schema (semantic layer discovery)
- Raw query execution (ad-hoc analytics capability)
- Server-side response filtering on every tool (essential for context window management)
- Clean stdio transport with zero stdout pollution (basic protocol contract)

**Should have (competitive differentiators):**
- Server-side search on chart listing (existing package returns 413KB unfiltered)
- Concise tool descriptions (reduce pre-conversation context overhead)
- Actionable error messages for LLM self-correction (not raw HTTP errors)
- Tool annotations (readOnlyHint: true signals no confirmation needed)
- Selective field projection per tool (intelligent column selection)

**Deliberately excluded (anti-features):**
- Write operations (create/update/delete) — dangerous without governance, keep read-only
- HTTP/SSE transport — adds complexity, no current need
- Catalog/metrics endpoints — redundant with explore tools
- Charts-as-code/dashboards-as-code — DevOps tools, not analytics tools
- Custom filter abstraction — leaky abstraction, pass through native Lightdash format
- Tool count beyond 9 — per research, 5-15 tools is optimal; 70+ tools correlate with worse performance

### Architecture Approach

Standard three-layer MCP server architecture with centralized API client and composition-based tool registration. Clean separation between transport (stdio), protocol (SDK), domain logic (tools), and HTTP client (Lightdash API).

**Major components:**
1. **Transport Layer** (StdioServerTransport) — reads JSON-RPC from stdin, writes to stdout, enforces zero stdout pollution
2. **Protocol Layer** (McpServer) — JSON-RPC dispatch, capability negotiation, Zod validation; SDK handles this entirely
3. **Tool Registry** — 9 tools grouped by domain (projects, charts, dashboards, spaces, queries); each registers via composition function
4. **Lightdash API Client** — single HTTP client handling auth headers (ApiKey format), response unwrapping ({ results } envelope), error mapping, and timeouts
5. **Response Formatter** — server-side filtering, field selection, Markdown table generation, pagination hints

**Project structure:**
```
src/
├── index.ts              # Entry point: stdout guards, server bootstrap, tool registration
├── client.ts             # Lightdash API client (fetch wrapper, auth, unwrapping)
├── tools/                # Tool definitions grouped by domain
│   ├── projects.ts       # list_projects
│   ├── charts.ts         # search_charts, get_chart, get_chart_results
│   ├── dashboards.ts     # list_dashboards
│   ├── spaces.ts         # list_spaces
│   └── queries.ts        # list_explores, get_explore, run_raw_query
├── types.ts              # TypeScript interfaces for API responses
├── formatter.ts          # Response shaping utilities
└── logger.ts             # stderr-only logging wrapper
```

**Key patterns:**
- Centralized API client with response envelope unwrapping
- Tool registration as composition functions (registerXTools(server, client))
- Server-side filtering for large payloads (search_charts filters 413KB in-memory)
- Outcome-oriented tool design (9 tools for user intents, not 30+ for REST endpoints)

### Critical Pitfalls

Research identified 6 critical pitfalls from the broken existing package, MCP specification, and production post-mortems:

1. **Stdout pollution kills connection instantly** — Any `console.log()` or third-party library writing to stdout corrupts JSON-RPC stream. Prevention: override console.log -> stderr at process startup, intercept stdout writes, ban console.log via eslint.

2. **Returning massive unfiltered API payloads** — Existing package returns 413KB chart lists consuming 100K+ tokens. Prevention: define response schemas per tool with field whitelists, hard cap at 4KB per response, implement server-side filtering and pagination.

3. **Confusing tool errors with protocol errors** — Throwing exceptions from tool handlers creates protocol errors that the LLM never sees. Prevention: wrap all tool handlers in try/catch that returns `isError: true` with actionable recovery hints.

4. **1:1 REST-to-MCP endpoint mapping** — Creates tool explosion requiring 3+ calls per user intent. Prevention: design tools around outcomes; let server orchestrate multi-API-call workflows internally; cap at 9-15 tools total.

5. **No request timeout on Lightdash API calls** — Query execution can hang 30+ seconds, blocking the MCP connection. Prevention: set per-request timeouts (30s default, 60s for queries) using AbortSignal.timeout, return meaningful timeout errors.

6. **Leaking Lightdash API keys in error messages** — HTTP error objects include request headers containing the API key. Prevention: sanitize all error messages before returning to LLM, strip URLs and headers, log full errors to stderr only.

**Phase 1 must establish:**
- Stdout guards before any imports
- Response size budgeting (4KB max)
- Error handler wrapper with sanitization
- API client with timeouts and envelope unwrapping
- Tool design around user intents (not endpoints)

## Implications for Roadmap

Based on combined research, the architecture has clear dependency ordering that determines phase structure:

### Suggested Phase Structure: 3 Phases

Research indicates a clean 3-phase structure following architectural dependencies:

### Phase 1: Foundation & Stdio Infrastructure
**Rationale:** Must establish stdout discipline and API client before any tools can be implemented. The 6 critical pitfalls must all be prevented in this phase—retrofitting later is expensive. Stdout pollution and response filtering are architectural concerns that affect every tool.

**Delivers:**
- Working stdio transport with stdout guards
- Lightdash API client with auth, unwrapping, timeouts, error sanitization
- Response formatter with field selection and size budgeting
- Stderr-only logger
- Tool handler wrapper with try/catch and isError responses

**Prevents pitfalls:**
- Pitfall 1 (stdout pollution) via console.log override and stdout intercept
- Pitfall 3 (protocol errors) via tool handler wrapper pattern
- Pitfall 5 (no timeouts) via API client with AbortSignal
- Pitfall 6 (API key leakage) via error sanitization

**No tools implemented yet** — this phase is pure infrastructure.

### Phase 2: Discovery & Metadata Tools (5 tools)
**Rationale:** Metadata tools have no dependencies on each other and are lowest complexity. All use simple GET endpoints with server-side filtering. These tools enable the LLM to discover what exists before executing queries or retrieving results. Follows natural user flow: discover projects -> discover spaces/charts/dashboards/explores.

**Delivers:**
- `list_projects` (entry point)
- `list_spaces(projectUuid)`
- `search_charts(projectUuid, query)` with 413KB -> filtered response
- `list_dashboards(projectUuid, query?)`
- `list_explores(projectUuid)`

**Addresses features:**
- Table stakes: project listing, space listing, chart/dashboard discovery, explore discovery
- Differentiator: server-side search/filtering on charts (the broken package's #1 failure)

**Prevents pitfalls:**
- Pitfall 2 (massive payloads) via server-side filtering on search_charts
- Pitfall 4 (1:1 mapping) via outcome-oriented tool design (search_charts, not list_charts + client-side filter)

### Phase 3: Data Access & Query Tools (4 tools)
**Rationale:** Data access tools depend on discovery tools (need UUIDs/names from Phase 2). Query execution is highest complexity (must handle Lightdash filter format, dimensions, metrics, sorts). Separating from Phase 2 allows testing discovery flow before adding query complexity.

**Delivers:**
- `get_chart(chartUuid)` — chart configuration detail
- `get_chart_results(chartUuid)` — execute saved chart, return data
- `get_explore(projectUuid, exploreName)` — full schema for query construction
- `run_raw_query(projectUuid, exploreName, dimensions, metrics, filters?, sorts?, limit?)` — ad-hoc analytics

**Addresses features:**
- Table stakes: chart detail, query result retrieval, explore schema, raw query execution
- Differentiator: native filter format pass-through (no leaky abstraction)

**Prevents pitfalls:**
- Pitfall 2 (massive payloads) via result limits and field filtering on get_explore
- Pitfall 5 (no timeouts) especially critical here (query execution is slow)

**Requires test-driven development:** run_raw_query has complex input validation (Lightdash filter format is nested JSON). Build test cases from Lightdash API docs before implementation.

### Phase Ordering Rationale

- **Phase 1 before 2/3:** All pitfall prevention must be in place before tools exist. Stdout guards cannot be retrofitted. Response filtering architecture cannot change without breaking all tools.
- **Phase 2 before 3:** Discovery tools (list_projects, search_charts) must exist before data access tools (get_chart_results needs chartUuid from search_charts). Logical user flow: discover -> retrieve.
- **Why not combine 2 & 3:** Separating discovery (5 simple GET endpoints) from data access (4 complex endpoints with query execution) allows validating the MCP server works end-to-end with simple tools before adding query complexity. Fail-fast strategy.

### Research Flags

**Phases likely needing deeper research:**
- **Phase 3 (run_raw_query):** Complex Lightdash filter/sort/dimension format. Will need test-driven development with Lightdash API docs + Inspector. Standard approach: copy exact request payloads from Lightdash UI network tab.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Foundation patterns are generic MCP/TypeScript (SDK docs + stack research cover it)
- **Phase 2:** All tools are simple GET + filter (architecture research covers pattern)

### Dependencies Across Phases

```
Phase 1: Foundation
    |
    | (provides: API client, response formatter, error handling)
    v
Phase 2: Discovery Tools
    |  (list_projects -> returns projectUuids)
    |  (search_charts -> returns chartUuids)
    |  (list_explores -> returns explore names)
    v
Phase 3: Data Access Tools
    |  (get_chart needs chartUuid from Phase 2)
    |  (get_chart_results needs chartUuid from Phase 2)
    |  (run_raw_query needs explore name + schema from Phase 2)
```

**Critical path:** Phase 1 blocks everything. Phase 2 must complete before Phase 3 can start (data access needs discovery).

### Tool Count per Phase

| Phase | Tools | Complexity | Notes |
|-------|-------|------------|-------|
| Phase 1 | 0 | HIGH | Infrastructure only; prevents all 6 pitfalls |
| Phase 2 | 5 | LOW-MEDIUM | Simple GET + filter; enables discovery |
| Phase 3 | 4 | MEDIUM-HIGH | POST endpoints; query execution; result handling |
| **Total** | **9** | | Within recommended 5-15 tool range |

### Integration Testing Strategy

- **After Phase 1:** Test stdout purity (pipe output through jq), test error sanitization (trigger API key error)
- **After Phase 2:** Test with MCP Inspector, verify search_charts filters 413KB -> ~4KB, test all discovery flows
- **After Phase 3:** Full integration test: discover project -> search chart -> get results; run raw query

### Success Criteria per Phase

**Phase 1 complete when:**
- [ ] Zero non-JSON-RPC output on stdout (tested via jq pipe)
- [ ] API client successfully calls Lightdash with auth + unwrapping
- [ ] Error handler wrapper catches exceptions and returns isError responses
- [ ] Response formatter reduces test payload from 413KB to <4KB

**Phase 2 complete when:**
- [ ] All 5 discovery tools registered and callable via MCP Inspector
- [ ] search_charts filters large chart lists server-side
- [ ] Each tool response <4KB with realistic Lightdash data
- [ ] LLM can discover projects, spaces, charts, dashboards, explores

**Phase 3 complete when:**
- [ ] get_chart_results successfully executes saved chart and returns data
- [ ] run_raw_query accepts native Lightdash filter format
- [ ] Query timeout errors return actionable messages
- [ ] Full discovery->execution workflow works end-to-end

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official MCP SDK v1.x is stable; Node 22 LTS well-documented; TypeScript 5.9 current release; all sources verified against official docs |
| Features | HIGH | Two existing Lightdash MCP packages analyzed; patterns verified across multiple BI MCP servers (Metabase, GoodData, Power BI); 9-tool scope well-validated |
| Architecture | HIGH | Standard MCP three-layer pattern documented in SDK; stdio transport is simplest pattern; composition-based tool registration confirmed in official examples |
| Pitfalls | HIGH | 6 critical pitfalls sourced from MCP specification, SDK issues, production post-mortems, and analysis of broken existing package; all have documented prevention strategies |

**Overall confidence:** HIGH

All core technical decisions (stack, architecture, pitfall prevention) are backed by official documentation or multiple production implementations. The only medium-confidence area is the exact Lightdash filter format for run_raw_query, which requires hands-on testing—but this is expected for complex query tools and addressed via TDD in Phase 3.

### Gaps to Address

**Filter format validation (Phase 3):** Lightdash's native filter format is nested JSON with dimension/metric references. Research confirmed the format exists in API docs, but exact validation rules need test-driven development. Mitigation: build test suite from Lightdash UI network requests before implementing run_raw_query.

**Response size validation:** Research establishes 4KB budget but doesn't provide exact field counts for real Lightdash instances. Mitigation: test with user's actual Lightdash instance during Phase 2 to validate filtering adequacy.

**Error message actionability:** Research identifies error sanitization pattern but doesn't enumerate all Lightdash API error codes. Mitigation: document error codes as they're encountered during testing; expand error formatter incrementally.

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) — v1.26.0 current, server/client patterns, stdio transport
- [MCP Official "Build a Server" Tutorial](https://modelcontextprotocol.io/docs/develop/build-server) — exact import paths, tsconfig, tool registration API
- [MCP Specification - Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) — stdout/stderr separation requirement
- [MCP Specification - Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) — isError flag behavior
- [Lightdash API Documentation](https://docs.lightdash.com/api-reference/v1/introduction) — REST endpoints, auth format, response envelope
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) — Node 22 LTS support window
- [TypeScript npm page](https://www.npmjs.com/package/typescript) — v5.9 current stable

### Secondary (MEDIUM confidence)
- [syucream/lightdash-mcp-server](https://github.com/syucream/lightdash-mcp-server) — existing TypeScript implementation with stdout pollution bug
- [poddubnyoleg/lightdash_mcp](https://github.com/poddubnyoleg/lightdash_mcp) — Python implementation with CRUD + query execution
- [Phil Schmid: MCP Best Practices](https://www.philschmid.de/mcp-best-practices) — outcome-oriented tool design, 5-15 tool limit
- [Axiom: Designing MCP Servers for Wide Schemas](https://axiom.co/blog/designing-mcp-servers-for-wide-events) — response size budgeting, CSV optimization
- [Tinybird: Analytics Agents Best Practices](https://www.tinybird.co/docs/forward/analytics-agents/best-practices) — tool curation, token efficiency
- [NearForm: MCP Tips, Tricks and Pitfalls](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) — comprehensive practitioner guide
- [MCP Server Development Guide (cyanheads)](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md) — layered architecture patterns
- [Anthropic Skills: Node MCP Server Reference](https://github.com/anthropics/skills/blob/main/skills/mcp-builder/reference/node_mcp_server.md) — official reference implementation
- [Nordic APIs: Why MCP Shouldn't Wrap an API One-to-One](https://nordicapis.com/why-mcp-shouldnt-wrap-an-api-one-to-one/) — 5.3x overhead from 1:1 mapping

### Tertiary (LOW confidence, validation needed)
- [MCPcat - Error Handling Guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/) — three-tier error model (needs verification against official spec)

---
*Research completed: 2026-02-10*
*Ready for roadmap: yes*
