# Architecture Research

**Domain:** MCP Server wrapping Lightdash REST API
**Researched:** 2026-02-10
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Host (Claude Desktop)                   │
│                                                                 │
│  stdin (JSON-RPC requests) ──┐    ┌── stdout (JSON-RPC responses)│
└──────────────────────────────┼────┼──────────────────────────────┘
                               │    │
                               v    ^
┌──────────────────────────────┼────┼──────────────────────────────┐
│                        MCP Server Process                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Transport Layer (StdioServerTransport)       │    │
│  │              Reads stdin, writes stdout, logs to stderr   │    │
│  └─────────────────────────┬────────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────v────────────────────────────────┐    │
│  │              Protocol Layer (McpServer)                    │    │
│  │              JSON-RPC dispatch, capability negotiation     │    │
│  └─────────────────────────┬────────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────v────────────────────────────────┐    │
│  │              Tool Registry                                │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │    │
│  │  │ list_    │ │ get_     │ │ search_  │ │ run_     │    │    │
│  │  │ projects │ │ chart    │ │ charts   │ │ query    │    │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │    │
│  │       │            │            │            │           │    │
│  └───────┼────────────┼────────────┼────────────┼───────────┘    │
│          │            │            │            │                │
│  ┌───────v────────────v────────────v────────────v───────────┐    │
│  │              Lightdash API Client                         │    │
│  │              Auth, HTTP calls, response unwrapping         │    │
│  └─────────────────────────┬────────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────v────────────────────────────────┐    │
│  │              Response Formatter                            │    │
│  │              Unwrap { results }, filter, shape for LLM     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  stderr ──> diagnostic logging (never stdout)                    │
└──────────────────────────────────────────────────────────────────┘
                               │
                               v (HTTPS)
┌──────────────────────────────────────────────────────────────────┐
│                     Lightdash Instance                            │
│                     /api/v1/* endpoints                           │
│                     Authorization: ApiKey <PAT>                   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Transport Layer | Reads JSON-RPC from stdin, writes responses to stdout, enforces zero stdout pollution | `StdioServerTransport` from SDK; instantiated in `index.ts` |
| Protocol Layer | JSON-RPC dispatch, capability negotiation, lifecycle (init/exchange/terminate) | `McpServer` from SDK; no custom code needed |
| Tool Registry | 9 registered tools with Zod schemas, descriptions, and handler functions | `server.registerTool()` calls, one per tool |
| Lightdash API Client | Single HTTP client handling auth headers, base URL, request execution, error mapping | Custom module: attaches `Authorization: ApiKey <token>`, calls fetch, unwraps `{ status, results }` |
| Response Formatter | Unwraps `results` from Lightdash envelope, applies server-side filtering (e.g., `search_charts` over 413K payload), shapes output for LLM consumption | Inline in tool handlers or shared utility functions |
| Logger | Diagnostic output to stderr only; never touches stdout | `console.error()` wrapper or structured logger writing to stderr |

## Recommended Project Structure

```
src/
├── index.ts               # Entry point: create server, register tools, connect transport
├── client.ts              # Lightdash API client (fetch wrapper, auth, response unwrapping)
├── tools/                 # Tool definitions (one file per tool or grouped by domain)
│   ├── projects.ts        # list_projects, get_project
│   ├── charts.ts          # search_charts, get_chart, get_chart_results
│   ├── dashboards.ts      # list_dashboards, get_dashboard
│   ├── spaces.ts          # list_spaces, get_space
│   └── queries.ts         # run_query
├── schemas/               # Zod schemas for tool inputs (co-located or separate)
│   └── index.ts           # Re-exports all schemas
├── types.ts               # TypeScript interfaces for Lightdash API responses
├── formatter.ts           # Response formatting utilities (Markdown tables, truncation)
└── logger.ts              # stderr-only logging utility
```

### Structure Rationale

- **`index.ts`:** Single entry point keeps the bootstrap sequence visible. Creates `McpServer`, imports tool registration functions, connects `StdioServerTransport`. This is the only file that touches transport.
- **`client.ts`:** Centralizes all HTTP communication with Lightdash. Every tool calls through this one module. Changes to auth, base URL, error handling, or response envelope unwrapping happen in one place.
- **`tools/`:** Grouped by Lightdash domain (projects, charts, dashboards, spaces, queries). Each file exports a `register*Tools(server, client)` function that calls `server.registerTool()`. This keeps tool definitions self-contained (schema + description + handler in one place) while allowing the entry point to compose them.
- **`schemas/`:** Optional separation. For 9 tools, co-locating Zod schemas inside tool files is simpler. Only extract to `schemas/` if schemas are shared across tools or grow complex.
- **`types.ts`:** TypeScript interfaces for Lightdash API response shapes. Keeps API contract knowledge separate from tool logic.
- **`formatter.ts`:** Shared formatting logic (Markdown table generation, result truncation, field selection). Tools that return similar shapes can reuse formatters.
- **`logger.ts`:** Thin wrapper ensuring all logging goes to stderr. Prevents accidental stdout pollution.

## Architectural Patterns

### Pattern 1: Centralized API Client with Response Unwrapping

**What:** A single module that handles all HTTP communication with Lightdash, including authentication injection and response envelope unwrapping.
**When to use:** Always. Every tool needs to call the Lightdash API; centralizing this prevents auth logic duplication and ensures consistent `{ status, results }` unwrapping.
**Trade-offs:** Adds one layer of indirection, but the alternative (raw fetch in every tool handler) leads to duplicated auth headers, inconsistent error handling, and scattered envelope unwrapping.

**Example:**
```typescript
// client.ts
interface LightdashClientConfig {
  baseUrl: string;   // e.g., "https://app.lightdash.cloud/api/v1"
  apiKey: string;    // Personal Access Token
}

export class LightdashClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: LightdashClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.headers = {
      'Authorization': `ApiKey ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers,
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Lightdash API ${response.status}: ${text}`);
    }
    const json = await response.json();
    // Unwrap the Lightdash envelope: { status: "ok", results: T }
    return json.results as T;
  }
}
```

### Pattern 2: Tool Registration as Composition Functions

**What:** Each domain file exports a function that takes `(server, client)` and registers its tools. The entry point calls all registration functions to compose the full server.
**When to use:** Always. Keeps tool definitions modular and the entry point clean.
**Trade-offs:** Slightly more ceremony than a single-file approach, but essential for maintainability with 9+ tools.

**Example:**
```typescript
// tools/charts.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";

export function registerChartTools(server: McpServer, client: LightdashClient) {
  server.registerTool(
    "lightdash_search_charts",
    {
      title: "Search Charts",
      description: "Search for saved charts in a Lightdash project by name. " +
        "Returns matching chart names, UUIDs, and the space they belong to.",
      inputSchema: {
        project_uuid: z.string().describe("UUID of the Lightdash project"),
        query: z.string().describe("Search term to filter chart names"),
      },
    },
    async ({ project_uuid, query }) => {
      const charts = await client.get<Chart[]>(
        `/projects/${project_uuid}/charts`
      );
      const filtered = charts.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      return {
        content: [{
          type: "text",
          text: formatChartsAsMarkdown(filtered),
        }],
      };
    }
  );

  // ... more chart tools
}

// index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LightdashClient } from "./client.js";
import { registerChartTools } from "./tools/charts.js";
import { registerProjectTools } from "./tools/projects.js";
// ...

const server = new McpServer({ name: "lightdash-mcp", version: "1.0.0" });
const client = new LightdashClient({
  baseUrl: process.env.LIGHTDASH_URL!,
  apiKey: process.env.LIGHTDASH_API_KEY!,
});

registerProjectTools(server, client);
registerChartTools(server, client);
// ... register remaining domains

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Pattern 3: Server-Side Filtering for Large Payloads

**What:** When the Lightdash API returns large payloads (e.g., all charts in a project is 413K), perform filtering server-side before returning results to the LLM. The LLM never sees the full payload.
**When to use:** Any tool where the API endpoint returns a list that could be large and the LLM only needs a subset. Specifically `search_charts` which filters a 413K chart list.
**Trade-offs:** The MCP server does more work (fetching full list, filtering in memory). But this is far better than sending 413K through the context window. The alternative (having the LLM paginate) wastes tokens and round-trips.

**Example:**
```typescript
// Inside search_charts tool handler
const allCharts = await client.get<Chart[]>(`/projects/${projectUuid}/charts`);
const matches = allCharts.filter(chart =>
  chart.name.toLowerCase().includes(query.toLowerCase())
);
// Return only matches -- not 413K of all charts
return {
  content: [{ type: "text", text: formatChartsAsMarkdown(matches) }],
};
```

### Pattern 4: Outcome-Oriented Tool Design (Not 1:1 Endpoint Mapping)

**What:** Design tools around what the LLM agent wants to accomplish, not around individual REST endpoints. Group related API calls when a single user intent requires multiple requests. Keep tools to 5-15 per server.
**When to use:** Always evaluate whether a tool maps to a user intent or just an API endpoint. With 9 tools for a focused Lightdash integration, this is already well-scoped.
**Trade-offs:** Requires upfront thought about user workflows. But 1:1 endpoint mapping creates "tool explosion" that confuses LLMs and wastes context tokens.

## Data Flow

### Request Flow (Tool Invocation)

```
Claude Desktop (MCP Host)
    │
    │  JSON-RPC request via stdin
    │  {"method": "tools/call", "params": {"name": "lightdash_search_charts", ...}}
    v
StdioServerTransport
    │  Parses JSON-RPC, routes to McpServer
    v
McpServer (Protocol Layer)
    │  Validates against registered tool schema (Zod)
    │  If invalid → JSON-RPC error response (-32602 InvalidParams)
    v
Tool Handler (e.g., charts.ts → search_charts)
    │  Calls LightdashClient with extracted params
    v
LightdashClient.get("/projects/{uuid}/charts")
    │  Attaches Authorization: ApiKey <token>
    │  Sends HTTPS GET to Lightdash instance
    v
Lightdash Instance
    │  Returns { status: "ok", results: [...] }
    v
LightdashClient.handleResponse()
    │  Checks HTTP status, unwraps { results }
    │  Returns typed data (Chart[])
    v
Tool Handler
    │  Applies server-side filtering (e.g., name match)
    │  Formats response as Markdown text
    v
McpServer
    │  Wraps in JSON-RPC response
    v
StdioServerTransport
    │  Writes JSON-RPC response to stdout
    v
Claude Desktop (receives results)
```

### Error Flow

```
Lightdash API returns error (4xx/5xx)
    │
    v
LightdashClient.handleResponse()
    │  Throws Error with status code and message
    v
Tool Handler catch block
    │  Returns MCP content with error description
    │  { content: [{ type: "text", text: "Error: ..." }] }
    │
    │  NOTE: Return error as content, do NOT throw.
    │  Throwing crashes the tool call. Returning error text
    │  lets the LLM read the error and self-correct.
    v
McpServer → StdioServerTransport → stdout → Claude
```

### Configuration Flow

```
Environment Variables (set in Claude Desktop config)
    │
    ├── LIGHTDASH_URL        → LightdashClient.baseUrl
    ├── LIGHTDASH_API_KEY    → LightdashClient.headers.Authorization
    └── LIGHTDASH_PROJECT_ID → (optional) default project for tools
    │
    v
index.ts reads process.env at startup
    │
    v
LightdashClient constructed with config
    │
    v
Passed to all registerXTools(server, client) calls
```

### Key Data Flows

1. **Tool invocation:** stdin JSON-RPC -> McpServer dispatch -> Zod validation -> tool handler -> LightdashClient HTTP call -> Lightdash API -> response unwrap -> format -> stdout JSON-RPC
2. **Error propagation:** Lightdash HTTP error -> LightdashClient throws -> tool handler catches -> returns error as text content (NOT thrown) -> LLM reads error and adapts
3. **Large payload filtering:** Lightdash returns full list (413K) -> LightdashClient unwraps -> tool handler filters in memory -> returns only matching subset to LLM
4. **Logging:** Any diagnostic output -> logger.ts -> stderr (never stdout)

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 9 tools (current) | Single-file-per-domain grouping. No caching needed. Direct fetch calls. |
| 15-25 tools | Consider Intent Multiplexing pattern (single dispatched tool per domain). Add request caching for repeated lookups. |
| 25+ tools | Split into multiple MCP servers by domain. Use gateway pattern. This is unlikely for a Lightdash integration. |

### Scaling Priorities

1. **First bottleneck: Large payload filtering.** The 413K chart list is the known hot path. If chart count grows, add in-memory caching with TTL (e.g., cache the full chart list for 60 seconds, filter from cache). This avoids re-fetching on repeated searches.
2. **Second bottleneck: Request latency.** Lightdash API calls add latency to every tool invocation. If tools are chained (LLM calls tool A, then tool B with results from A), total latency compounds. Mitigation: ensure tool responses include enough context that the LLM does not need to make unnecessary follow-up calls.

## Anti-Patterns

### Anti-Pattern 1: Console.log Anywhere in the Codebase

**What people do:** Use `console.log()` for debugging during development and forget to remove it, or use a logging library that defaults to stdout.
**Why it's wrong:** Stdio transport uses stdout exclusively for JSON-RPC messages. Any stray stdout output corrupts the protocol stream, causing Claude Desktop to fail silently or crash the connection.
**Do this instead:** Create a `logger.ts` that wraps `console.error()`. Use it everywhere. Ban `console.log` via ESLint rule (`no-console` with `allow: ["error", "warn"]`). Test by running the server and verifying zero non-JSON-RPC output on stdout.

### Anti-Pattern 2: Throwing Errors from Tool Handlers

**What people do:** Let exceptions propagate out of tool handlers (e.g., `throw new Error("API failed")`).
**Why it's wrong:** An unhandled throw in a tool handler surfaces as a JSON-RPC error to the MCP host, which typically means the LLM sees "tool call failed" with no useful context. The LLM cannot self-correct because it does not know what went wrong.
**Do this instead:** Catch all errors in the tool handler. Return the error as text content: `{ content: [{ type: "text", text: "Lightdash API returned 404: Project not found. Check the project UUID." }] }`. This gives the LLM actionable information.

### Anti-Pattern 3: Exposing Raw API Responses to LLM

**What people do:** Pass the entire Lightdash JSON response through as `JSON.stringify(results)`.
**Why it's wrong:** Raw API responses contain fields the LLM does not need, waste context tokens, and force the LLM to parse nested structures. A 413K chart list serialized as JSON will likely exceed context limits or produce poor results.
**Do this instead:** Select relevant fields, format as Markdown (tables for lists, headers for details), and truncate if needed. The LLM understands `| Chart Name | UUID | Space |` far better than nested JSON.

### Anti-Pattern 4: Hardcoding Configuration

**What people do:** Put Lightdash URL and API key directly in source code or a committed config file.
**Why it's wrong:** Leaks credentials, prevents different users from configuring their own instances, and breaks the standard MCP server configuration pattern (Claude Desktop passes env vars).
**Do this instead:** Read `LIGHTDASH_URL` and `LIGHTDASH_API_KEY` from `process.env`. Validate they exist at startup. Fail fast with a clear error to stderr if missing.

### Anti-Pattern 5: One Tool Per REST Endpoint

**What people do:** Create `get_project`, `list_project_members`, `get_project_settings`, `get_project_warehouse_connection` as separate tools for every endpoint.
**Why it's wrong:** Tool explosion overwhelms LLM context. The LLM must read descriptions of all tools to decide which to call. More tools means more confusion and more hallucinated tool calls.
**Do this instead:** Design tools around user intents. `get_project` should return the information an LLM needs about a project in one call. Combine related endpoints internally if a single user question ("tell me about this project") requires data from multiple endpoints.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Lightdash REST API | HTTPS GET/POST via `LightdashClient` | Auth: `Authorization: ApiKey <PAT>` header. All responses wrapped in `{ status: "ok", results: T }`. Base URL from env var. |
| Claude Desktop | Stdio transport (stdin/stdout) | JSON-RPC 2.0 over newline-delimited messages. Server is spawned as child process. Config in `claude_desktop_config.json`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| index.ts (entry) <-> tools/* | Function calls: `registerXTools(server, client)` | Entry point composes all tools. Tools receive server and client as dependencies. |
| tools/* <-> client.ts | Method calls: `client.get<T>(path)`, `client.post<T>(path, body)` | Tools never construct HTTP requests directly. All API access goes through client. |
| tools/* <-> formatter.ts | Function calls: `formatAsMarkdown(data)` | Tools call formatters for consistent output shaping. Formatters have no knowledge of MCP protocol. |
| All modules <-> logger.ts | Function calls: `log.info(msg)`, `log.error(msg)` | All diagnostic output funneled through stderr-only logger. |
| index.ts <-> process.env | Environment variable reads at startup | Config is read once, validated, and injected into client constructor. Tools never read env vars directly. |

## Build Order (Dependency Chain)

The architecture has clear dependency ordering that determines build phases:

```
Phase 1: Foundation (no dependencies)
  ├── logger.ts          (standalone, stderr-only output)
  ├── types.ts           (standalone, TypeScript interfaces)
  └── client.ts          (depends on: types.ts for response shapes)

Phase 2: Tools (depends on Phase 1)
  ├── tools/projects.ts  (depends on: client.ts, types.ts)
  ├── tools/charts.ts    (depends on: client.ts, types.ts, formatter.ts)
  ├── tools/dashboards.ts
  ├── tools/spaces.ts
  └── tools/queries.ts

Phase 3: Entry Point (depends on Phase 1 + 2)
  └── index.ts           (depends on: all tools/*, client.ts, McpServer, StdioServerTransport)

Phase 4: Build/Deploy
  └── tsconfig.json, package.json, compilation to dist/
```

**Why this order:**
- Logger and types are leaf dependencies with no imports from the project.
- The API client depends only on types and logger.
- Tools depend on the client (to make API calls) and types (for response shapes).
- The entry point depends on everything -- it is the composition root.
- Build each phase, test it in isolation, then move to the next. The client can be tested with direct API calls before any tools exist. Tools can be tested by mocking the client. The entry point just wires everything together.

## Sources

- [MCP TypeScript SDK - GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- HIGH confidence, official SDK repository
- [MCP TypeScript SDK Server Docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- HIGH confidence, official documentation
- [Anthropic Skills: Node MCP Server Reference](https://github.com/anthropics/skills/blob/main/skills/mcp-builder/reference/node_mcp_server.md) -- HIGH confidence, Anthropic's own reference guide
- [MCP Server Development Guide (cyanheads)](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md) -- MEDIUM confidence, community resource verified against SDK docs
- [Example MCP Server STDIO (yigitkonur)](https://github.com/yigitkonur/example-mcp-server-stdio) -- MEDIUM confidence, reference implementation demonstrating layered architecture
- [Phil Schmid: MCP Best Practices](https://www.philschmid.de/mcp-best-practices) -- MEDIUM confidence, well-sourced practitioner guide
- [Two Essential Patterns for MCP Servers (shaaf.dev)](https://shaaf.dev/post/2026-01-08-two-essential-patterns-for-buildingm-mcp-servers/) -- MEDIUM confidence, Intent Multiplexing and Command Pattern
- [54 Patterns for Building Better MCP Tools (Arcade)](https://blog.arcade.dev/mcp-tool-patterns) -- MEDIUM confidence, pattern catalog
- [Xata MCP Server Architecture (xata.io)](https://xata.io/blog/built-xata-mcp-server) -- MEDIUM confidence, real-world REST-to-MCP case study
- [Nearform: MCP Tips, Tricks, and Pitfalls](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) -- MEDIUM confidence, practitioner pitfalls
- [Lightdash API Documentation](https://docs.lightdash.com/api-reference/v1/introduction) -- HIGH confidence, official Lightdash docs
- [Lightdash Personal Access Tokens](https://docs.lightdash.com/references/personal_tokens) -- HIGH confidence, official auth docs

---
*Architecture research for: Lightdash MCP Server*
*Researched: 2026-02-10*
