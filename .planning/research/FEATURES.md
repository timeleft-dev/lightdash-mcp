# Feature Research

**Domain:** MCP Server for BI/Analytics (Lightdash)
**Researched:** 2026-02-10
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Project listing** | Every BI MCP server exposes project/workspace enumeration as the entry point for discovery. Both existing Lightdash MCP packages do this. | LOW | `list_projects()` -- return name, uuid, warehouseType only. Strip connection details, credentials, dbt config. |
| **Space listing** | Spaces are the organizational primitive in Lightdash. Without them, users cannot navigate to content. | LOW | `list_spaces(projectUuid)` -- return uuid, name, isPrivate, access info. |
| **Chart/saved question discovery** | The primary reason to connect to Lightdash: find and retrieve charts. Every BI MCP server (Metabase, GoodData, Power BI) provides question/chart listing. | LOW | `list_charts` or `search_charts(projectUuid, query)` -- the search variant is strictly better (see Differentiators). |
| **Dashboard listing** | Dashboards are the second core content type. Metabase MCP, GoodData MCP, and the existing Lightdash MCP all expose this. | LOW | `list_dashboards(projectUuid, query?)` -- return uuid, name, description, spaceUuid, updatedAt. |
| **Explore/table discovery** | Explores (Lightdash's semantic layer) are how users understand what data is queryable. The poddubnyoleg/lightdash_mcp server exposes `list-explores` and `get-explore-schema`. | LOW | `list_explores(projectUuid)` -- return name, label, description, tags. |
| **Explore schema retrieval** | Users need to understand dimensions, metrics, and relationships before querying. Without full schema access, the LLM cannot construct valid queries. | MEDIUM | `get_explore(projectUuid, exploreName)` -- return full dimension/metric definitions. This payload can be large; consider filtering to just names, types, labels, and descriptions. |
| **Chart detail retrieval** | After discovering a chart, users need its configuration (what dimensions/metrics, filters, chart type). Both existing packages expose this. | LOW | `get_chart(chartUuid)` -- return config, table config, chart type. Filter out internal rendering state. |
| **Query result retrieval** | The core value of BI access: getting actual data. Every BI MCP server provides some form of query execution. Metabase has `execute_card`, GoodData exposes analytics execution. | MEDIUM | `get_chart_results(chartUuid)` -- POST to run the saved chart and return rows. Must handle potentially large result sets. |
| **Server-side response filtering** | This is table stakes for ANY MCP server. Per Axiom, Tinybird, and Philschmid's best practices: "MCP servers are not data dump services." Raw API passthrough breaks the context window. The broken lightdash-mcp-server's 413K payload dumps are the exact anti-pattern every MCP best-practices guide warns against. | MEDIUM | Every tool must strip unnecessary fields. Return only what the LLM needs to reason about the data. This is the #1 reason to build a custom server. |
| **Clean stdio transport** | Claude Desktop requires stdio. The broken package pollutes stdout with console.log. This is not optional -- it is the basic contract of MCP stdio transport. | LOW | Zero non-JSON-RPC output on stdout. All logging to stderr. |
| **Proper error handling** | MCP spec says tool errors should be reported via `isError: true` in the result object, not as protocol-level errors. This lets the LLM see and recover from failures. | LOW | Catch API errors, return structured error messages with actionable context (e.g., "Project UUID not found. Use list_projects to get valid UUIDs."). |
| **Response envelope unwrapping** | Lightdash wraps all responses in `{ status: "ok", results: ... }`. Passing this wrapper through wastes tokens and confuses the LLM. | LOW | Automatic unwrapping in the API client layer. |

### Differentiators (Competitive Advantage)

Features that set this server apart from the two existing Lightdash MCP packages and from generic BI MCP patterns.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Server-side search/filtering on chart listing** | The existing syucream/lightdash-mcp-server returns the full 413K chart list unfiltered. Our `search_charts(projectUuid, query)` does case-insensitive name matching server-side and returns only uuid/name/spaceName/chartType/chartKind/updatedAt/slug. This is the single biggest improvement over the existing package. | LOW | This is essentially `list_charts` with a mandatory filter. Key insight: make `query` optional so it also serves as the list endpoint, but always return the minimal field set. |
| **Raw query execution** | The syucream package has zero query execution capability. The poddubnyoleg package has `run-raw-query` but it is Python-only. Exposing `run_raw_query(projectUuid, exploreName, dimensions, metrics, filters?, sorts?, limit?)` in TypeScript with native Lightdash filter format pass-through enables Claude to answer ad-hoc analytical questions. | HIGH | This is the highest-complexity tool. Must correctly construct the Lightdash RunQuery payload format with dimensions array, metrics array, filter objects, sort objects, and limit. Native filter format pass-through avoids building an abstraction layer. |
| **Concise tool descriptions** | Per Claude Code's context optimization: every tool description consumes context tokens before the conversation starts. MCP servers with 67K+ tokens of tool descriptions are documented problems. Keeping descriptions concise but clear saves 40-50% of overhead context. | LOW | Write tool descriptions as single sentences. Put detailed usage in error messages, not in the schema description. |
| **Pagination metadata on large results** | Per Tinybird and Axiom best practices: when results are truncated, explicitly tell the LLM. Include "Showing N of M total results" and guidance on how to narrow the query. LLMs often ignore structured pagination fields, so embed this as text in the response. | LOW | Add textual pagination hints to responses: "Showing 50 of 234 charts. Use the query parameter to narrow results." |
| **Tool annotations (readOnlyHint)** | MCP spec supports tool annotations like `readOnlyHint: true`. Since this is a read-only server, marking all tools with `readOnlyHint: true` signals to clients that no confirmation dialogs are needed, reducing friction. | LOW | All 9 tools get `annotations: { readOnlyHint: true, destructiveHint: false }`. |
| **Selective field projection per tool** | Instead of returning whatever the API gives, each tool has a hardcoded field whitelist. This is what Axiom calls "intelligent column selection" -- retaining signal, dropping noise. The existing package returns everything. | MEDIUM | Define a TypeScript interface per tool response. Map API response to that interface, dropping all other fields. |
| **Actionable error messages for LLM recovery** | Per MCP best practices: error messages are injected into the LLM context just like successful responses. Returning "API returned 404" is useless. Returning "Chart UUID 'abc123' not found. Use search_charts to find valid chart UUIDs." teaches the LLM to self-correct. | LOW | Each error handler maps HTTP status codes to LLM-friendly recovery instructions. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Write operations (create/update/delete charts, dashboards)** | The poddubnyoleg package exposes create-chart, update-chart, delete-chart, create-dashboard, create-space. Seems powerful. | Write operations through an LLM are dangerous without governance. A misunderstood prompt could delete dashboards or create incorrect charts that mislead business users. MCP best practices: "Mark destructive actions clearly and require confirmation." Claude Desktop has no robust confirmation flow for destructive MCP actions. | Keep the server read-only. Users create/edit in the Lightdash UI where there's proper preview, undo, and access control. Revisit write operations only if a clear governance model exists. |
| **HTTP/SSE transport** | The syucream package supports both stdio and StreamableHTTP. Useful for multi-client scenarios. | Doubles the transport surface area, adds configuration complexity, introduces security concerns (network exposure, CORS, auth). Claude Desktop uses stdio. No other client is in scope. | Build stdio only. If HTTP is needed later, it is a separate concern that can be added without changing tool logic. |
| **Catalog/metrics catalog endpoints** | The syucream package exposes `get_catalog`, `get_metrics_catalog`, `get_custom_metrics`. Seems useful for data discovery. | These endpoints return very large payloads (entire project catalog). They overlap significantly with `list_explores` + `get_explore` which provide the same information in a more structured, queryable way. Adding them increases the tool count without clear incremental value. Per MCP best practices: "Limit servers to 5-15 tools maximum." | Use `list_explores` for discovery and `get_explore` for detail. This covers the same use case with two tools instead of three. |
| **Charts-as-code / Dashboards-as-code** | The syucream package exposes `get_charts_as_code` and `get_dashboards_as_code`. Appeals to infrastructure-as-code workflows. | These are developer/DevOps tools, not analytics tools. The MCP server's purpose is data exploration and analysis, not deployment automation. These tools return massive YAML payloads that waste context window on non-analytical content. | Out of scope. If needed, these are better served by a separate DevOps-focused MCP server or CLI tool. |
| **Custom filter abstraction layer** | Tempting to simplify Lightdash's native filter format into something more LLM-friendly (e.g., simple key-value pairs). | Creates a leaky abstraction. The LLM must learn the custom format, and edge cases (nested AND/OR, multi-value filters) inevitably break. The native format is well-documented and the LLM can learn it from `get_explore` schema output. | Pass through native Lightdash filter format in `run_raw_query`. Provide clear documentation in the tool description for the filter shape. |
| **Caching layer** | Reduces API calls, speeds up repeated queries. Standard optimization pattern. | Adds state management, cache invalidation complexity, stale data risk. For a single-user Claude Desktop tool, API latency is already subsecond for most endpoints. Cache adds complexity without meaningful benefit. | Direct API calls. Lightdash's own caching handles repeated queries. If performance becomes an issue, add caching as a targeted optimization later. |
| **OAuth / multi-auth** | Supports different authentication methods for enterprise scenarios. | PAT (Personal Access Token) is the documented auth method for Lightdash API. Adding OAuth adds PKCE flow, token refresh, redirect handling -- enormous complexity for a stdio-based CLI tool. No user has requested it. | PAT only via `LIGHTDASH_API_KEY` env var. This is what Lightdash recommends for API access. |
| **Tool proliferation beyond 9 tools** | More tools = more capabilities. The Metabase MCP server brags about "70+ tools." | Per Philschmid: "More tools does not correlate with better agents." Per Tinybird: "Agents degrade rapidly when more than three steps are required." Each tool adds ~200-500 tokens of context overhead before any conversation starts. 70 tools = 14K-35K tokens of overhead. 9 tools = ~2K-4.5K tokens. | Cap at 9 tools for v1. Each tool should be high-value. Add tools only when there is clear user need, not speculative capability. |

## Feature Dependencies

```
list_projects
    |
    v
list_spaces(projectUuid) ----+
    |                         |
    v                         v
search_charts ---------> get_chart(chartUuid)
    |                         |
    |                         v
    |                    get_chart_results(chartUuid)
    |
list_dashboards(projectUuid)
    |
list_explores(projectUuid)
    |
    v
get_explore(projectUuid, exploreName)
    |
    v
run_raw_query(projectUuid, exploreName, dimensions, metrics, ...)
```

### Dependency Notes

- **list_projects is the entry point:** Every other tool requires a projectUuid (except get_chart/get_chart_results which need chartUuid). The LLM must call list_projects first to discover valid UUIDs.
- **get_explore enables run_raw_query:** The LLM needs to know available dimensions and metrics from get_explore before it can construct a valid run_raw_query call. Without this, the LLM would hallucinate field names.
- **search_charts enables get_chart enables get_chart_results:** This is the natural discovery flow: find a chart by name, get its config, then get its data.
- **list_explores enables get_explore:** Explore names are opaque strings (e.g., "orders"). The LLM needs the list to discover valid names.
- **No circular dependencies:** The graph is a clean DAG. Phase ordering follows the dependency direction.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to replace the broken lightdash-mcp-server.

- [x] `list_projects()` -- entry point for all project-scoped tools
- [x] `search_charts(projectUuid, query)` -- the #1 use case and the #1 broken thing in the existing package
- [x] `get_chart(chartUuid)` -- chart configuration detail
- [x] `get_chart_results(chartUuid)` -- actual chart data retrieval
- [x] `list_spaces(projectUuid)` -- organizational navigation
- [x] `list_dashboards(projectUuid, query?)` -- dashboard discovery
- [x] `list_explores(projectUuid)` -- semantic layer discovery
- [x] `get_explore(projectUuid, exploreName)` -- schema detail for query construction
- [x] `run_raw_query(projectUuid, exploreName, dimensions, metrics, ...)` -- ad-hoc analytics
- [x] Server-side field filtering on every response
- [x] Clean stdio transport with zero stdout pollution
- [x] Actionable error messages with recovery hints

**Rationale:** All 9 tools ship in v1 because the use case is narrow and well-defined. This is not a phased rollout of tools -- it is a single-purpose server replacing a broken one. The tool count (9) is within the recommended 5-15 range.

### Add After Validation (v1.x)

Features to add once the core is working and users identify real needs.

- [ ] **Pagination controls** -- if result sets prove too large even after filtering, add explicit limit/offset parameters to list endpoints. Trigger: users report truncated results losing important data.
- [ ] **CSV output mode** -- per Axiom research, CSV saves ~29% tokens vs JSON for tabular data. Trigger: users report context window exhaustion on large query results.
- [ ] **Dashboard detail retrieval** -- `get_dashboard(dashboardUuid)` to get tiles, filters, layout. Trigger: users want to understand dashboard composition, not just list them.
- [ ] **Prompt templates** -- pre-built prompts like "Analyze this chart" or "Compare these metrics" that structure common workflows. Trigger: users repeatedly ask the same types of analytical questions.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Scheduled query results** -- retrieve cached/scheduled refresh results instead of live queries. Why defer: requires understanding Lightdash's scheduler API and adds state management.
- [ ] **Multi-project context** -- tools that work across projects simultaneously. Why defer: increases complexity significantly and most users work within a single project.
- [ ] **Write operations** -- chart/dashboard creation. Why defer: governance model needed (see Anti-Features).
- [ ] **HTTP transport** -- for non-Claude-Desktop clients. Why defer: no current client need.
- [ ] **Resource primitives** -- expose projects and explores as MCP resources (application-controlled context) rather than only tools (model-controlled). Why defer: Claude Desktop's resource support is limited and not well-documented for this use case.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Server-side response filtering | HIGH | LOW | P1 |
| Clean stdio transport | HIGH | LOW | P1 |
| search_charts with field filtering | HIGH | LOW | P1 |
| list_projects | HIGH | LOW | P1 |
| get_chart | HIGH | LOW | P1 |
| get_chart_results | HIGH | MEDIUM | P1 |
| list_spaces | MEDIUM | LOW | P1 |
| list_dashboards | MEDIUM | LOW | P1 |
| list_explores | HIGH | LOW | P1 |
| get_explore | HIGH | MEDIUM | P1 |
| run_raw_query | HIGH | HIGH | P1 |
| Actionable error messages | MEDIUM | LOW | P1 |
| Tool annotations (readOnlyHint) | LOW | LOW | P1 |
| Pagination metadata | MEDIUM | LOW | P2 |
| CSV output mode | MEDIUM | MEDIUM | P2 |
| Dashboard detail retrieval | LOW | LOW | P2 |
| Prompt templates | LOW | MEDIUM | P3 |
| Write operations | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- all 9 tools + infrastructure
- P2: Should have, add when user feedback indicates need
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | syucream/lightdash-mcp-server (TS) | poddubnyoleg/lightdash_mcp (Python) | Our Approach |
|---------|-------------------------------------|--------------------------------------|--------------|
| **Project listing** | Yes (list_projects, get_project) | Yes (list-projects, get-project) | Yes (list_projects, minimal fields) |
| **Chart listing** | Yes (list_charts, unfiltered) | Yes (with CRUD) | search_charts with server-side filtering and field projection |
| **Chart results** | No | Yes (run-chart-query) | Yes (get_chart_results) |
| **Dashboard listing** | Yes (list_dashboards) | Yes (with CRUD) | Yes (list_dashboards with optional search) |
| **Explore listing** | No | Yes (list-explores) | Yes (list_explores, minimal fields) |
| **Explore schema** | No | Yes (get-explore-schema) | Yes (get_explore) |
| **Raw query** | No | Yes (run-raw-query) | Yes (run_raw_query, native filter format) |
| **Response filtering** | No -- returns raw API payloads | Unknown | Yes -- every tool has field whitelist |
| **Write operations** | No | Yes (create/update/delete) | No -- deliberately read-only |
| **Catalog endpoints** | Yes (3 catalog tools) | No | No -- covered by explores |
| **Charts/dashboards as code** | Yes (2 tools) | No | No -- out of scope |
| **Transport** | Stdio + HTTP | Stdio | Stdio only |
| **Language** | TypeScript | Python | TypeScript |
| **Total tools** | 10 | ~20+ | 9 |
| **Stdout cleanliness** | Broken (console.log pollution) | Unknown | Clean (stderr-only logging) |

### Key Competitive Insight

The syucream package covers metadata/discovery but cannot execute queries or explore schemas. The poddubnyoleg package covers everything including writes but is Python-only and has no response filtering. Our server hits the sweet spot: all the read operations users actually need, in TypeScript for the Claude Desktop ecosystem, with aggressive response filtering that makes every tool output context-window-friendly.

## Sources

- [syucream/lightdash-mcp-server](https://github.com/syucream/lightdash-mcp-server) -- existing TypeScript Lightdash MCP server, 10 tools, no query execution (HIGH confidence)
- [poddubnyoleg/lightdash_mcp](https://github.com/poddubnyoleg/lightdash_mcp) -- Python Lightdash MCP server with CRUD and query execution (HIGH confidence)
- [Lightdash API docs](https://docs.lightdash.com/api-reference/v1/introduction) -- official API reference (HIGH confidence)
- [Axiom: Designing MCP servers for wide schemas](https://axiom.co/blog/designing-mcp-servers-for-wide-events) -- cell budgeting, column selection, CSV optimization (HIGH confidence)
- [Tinybird: Analytics agents best practices](https://www.tinybird.co/docs/forward/analytics-agents/best-practices) -- tool curation, token efficiency, anti-patterns (HIGH confidence)
- [Philschmid: MCP best practices](https://www.philschmid.de/mcp-best-practices) -- outcomes over operations, flatten arguments, 5-15 tool limit (HIGH confidence)
- [MCP spec: Tool annotations](https://modelcontextprotocol.io/legacy/concepts/tools) -- readOnlyHint, destructiveHint (HIGH confidence)
- [Power BI Modeling MCP Server](https://github.com/microsoft/powerbi-modeling-mcp) -- enterprise BI MCP server with prompts, 20+ tool categories (MEDIUM confidence)
- [GoodData MCP Server](https://www.gooddata.com/docs/cloud/experimental-features/mcp-server/) -- 24 tools, workspace isolation, governed analytics (MEDIUM confidence)
- [Metabase MCP servers](https://github.com/easecloudio/mcp-metabase-server) -- 70+ tools as anti-pattern example (MEDIUM confidence)
- [MCP pagination spec](https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination) -- cursor-based pagination standard (HIGH confidence)
- [Context window impact of MCPs](https://github.com/anthropics/claude-code/issues/3036) -- 67K token overhead from 4 MCP servers (HIGH confidence)

---
*Feature research for: Lightdash MCP Server*
*Researched: 2026-02-10*
