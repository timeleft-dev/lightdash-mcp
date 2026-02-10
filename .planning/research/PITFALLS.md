# Pitfalls Research

**Domain:** MCP Server wrapping Lightdash REST API (stdio transport, TypeScript)
**Researched:** 2026-02-10
**Confidence:** HIGH -- sourced from MCP specification, official SDK docs, multiple production post-mortems, and the known bugs in the package being replaced

## Critical Pitfalls

### Pitfall 1: Stdout Pollution Kills the Connection Instantly

**What goes wrong:**
Any bytes written to stdout that are not valid JSON-RPC messages corrupt the protocol stream. The MCP client parses every line from stdout as JSON-RPC. A single `console.log("debug")` causes a parse error, and the client disconnects. This is the exact bug in the existing `@lightdash/mcp` package -- it uses `console.log` for debug output, mixing human-readable text with JSON-RPC messages on stdout.

**Why it happens:**
- Developers use `console.log()` out of habit; it writes to stdout by default in Node.js
- Third-party dependencies (HTTP clients, logging libraries, ORMs) may call `console.log()` internally
- Error stack traces from uncaught exceptions print to stdout
- Libraries that print startup banners or deprecation warnings to stdout
- During development, temporary debug statements slip through

**How to avoid:**
1. **Override `console.log` at process startup** -- redirect it to stderr before any imports:
   ```typescript
   const originalLog = console.log;
   console.log = (...args: unknown[]) => {
     console.error(...args); // redirect to stderr
   };
   ```
2. **Use a stderr-only logger** -- configure a logging library (e.g., pino) to write exclusively to stderr
3. **Intercept stdout at the stream level** -- use `process.stdout.write` override as a safety net to catch any rogue writes from dependencies:
   ```typescript
   const originalWrite = process.stdout.write.bind(process.stdout);
   process.stdout.write = (chunk: any, ...args: any[]) => {
     // Only allow writes that look like JSON-RPC
     if (typeof chunk === 'string' && !chunk.startsWith('{')) {
       process.stderr.write(chunk); // redirect non-JSON to stderr
       return true;
     }
     return originalWrite(chunk, ...args);
   };
   ```
4. **Lint rule** -- ban `console.log` in eslint config with `no-console` rule (allow `console.error` only)
5. **CI test** -- run the server with a test client and verify zero non-JSON-RPC output on stdout

**Warning signs:**
- `MCP error -32000: Connection closed` in client logs
- `Failed to parse JSONRPC message from server` errors
- Server works in unit tests but fails when connected to Claude Desktop / Cursor
- Intermittent disconnections that correlate with specific tool calls (the ones that trigger library logging)

**Phase to address:** Phase 1 (Foundation) -- this must be solved before any tool implementation begins. The stdout guard should be the first thing the server entrypoint does, before importing any other module.

---

### Pitfall 2: Returning Massive Unfiltered API Payloads

**What goes wrong:**
Lightdash API endpoints return large JSON responses -- the existing `@lightdash/mcp` package returns 413KB payloads. These get injected into the LLM's context window, consuming tens of thousands of tokens. A single tool call returning 413KB of JSON can consume 100K+ tokens, which is 50%+ of Claude's context window. The LLM either fails to process it, hallucinates about the data, or runs out of context for follow-up operations.

Research from Queen's University found that API-wrapper MCP servers that dump raw responses average 5.3x more tool invocations per task than domain-optimized implementations. Figma's MCP server documented responses exceeding 351,378 tokens before they implemented pagination.

**Why it happens:**
- Direct passthrough of REST API responses without transformation
- Returning all fields from API objects when only a subset is relevant
- Not implementing pagination for list endpoints
- Including nested objects (e.g., full chart configs, SQL queries, metadata) when summaries suffice
- Treating MCP tools like REST API proxies instead of AI-optimized interfaces

**How to avoid:**
1. **Define response schemas per tool** -- explicitly select which fields to return, never pass through raw API responses
2. **Implement a response size budget** -- hard cap at ~4KB per tool response (roughly 1K tokens); truncate with a `"truncated": true` flag and a count of omitted items
3. **Paginate list endpoints** -- return 20-50 items max with `has_more`, `next_offset`, `total_count` metadata
4. **Flatten nested structures** -- extract only the fields an LLM needs to make decisions
5. **Use CSV format for tabular data** -- 29% fewer tokens than JSON for equivalent data (per Axiom's benchmarks)
6. **Summarize, don't dump** -- for query results, return row counts + column summaries + first N rows, not the entire dataset

**Warning signs:**
- Tool responses exceeding 4KB
- LLM responses that ignore or misinterpret tool output
- Context window errors from the LLM client
- Slow tool responses (large payloads take time to serialize and transmit over stdio)
- Claude saying "The response is too large for me to process" or similar

**Phase to address:** Phase 1 (Foundation) -- response shaping must be designed into the tool architecture from the start. Retrofitting response filtering onto tools that already pass through raw API data requires touching every tool handler.

---

### Pitfall 3: Confusing Tool Errors with Protocol Errors

**What goes wrong:**
Developers throw exceptions from tool handlers when the Lightdash API returns an error (404, 500, rate limit). These become JSON-RPC protocol-level errors. Protocol errors are captured by the MCP client, shown as a UI notification, and **discarded** -- the LLM never sees them and cannot recover. The LLM has no idea what went wrong or what to try next.

The correct behavior is to return a `CallToolResult` with `isError: true` and a descriptive message. This injects the error into the LLM's context window, allowing it to understand the failure and self-correct (e.g., "Project not found. Available projects are: X, Y, Z. Try again with one of these.").

**Why it happens:**
- REST API error handling muscle memory: `throw new Error("Not found")`
- Not understanding the MCP three-tier error model (transport / protocol / application)
- Uncaught promise rejections from HTTP client calls bubbling up as protocol errors
- Missing try/catch around Lightdash API calls

**How to avoid:**
1. **Wrap every tool handler in try/catch** that converts exceptions to `isError` responses:
   ```typescript
   server.tool("lightdash_get_project", schema, async (params) => {
     try {
       const result = await lightdashClient.getProject(params.projectId);
       return { content: [{ type: "text", text: formatProject(result) }] };
     } catch (error) {
       return {
         isError: true,
         content: [{ type: "text", text: formatErrorForLLM(error) }],
       };
     }
   });
   ```
2. **Write `formatErrorForLLM` as a first-class utility** -- translate HTTP status codes into actionable guidance, not raw error dumps
3. **Never expose stack traces, API keys, or internal URLs** in error messages
4. **Include recovery hints** -- "Chart not found. Use lightdash_list_charts to find available charts."

**Warning signs:**
- LLM says "I encountered an error" without details about what happened
- Claude Desktop shows error toasts but the conversation has no error context
- The LLM retries the exact same failing call repeatedly (it cannot learn from protocol errors)
- Unhandled promise rejection warnings in server stderr logs

**Phase to address:** Phase 1 (Foundation) -- the tool handler wrapper pattern should be established before implementing individual tools. Create a `wrapToolHandler` utility that all tools use.

---

### Pitfall 4: 1:1 REST-to-MCP Endpoint Mapping

**What goes wrong:**
Mapping each Lightdash REST endpoint directly to an MCP tool forces the LLM to orchestrate multi-step workflows that the server should handle internally. For example: to get chart results, the LLM must call `get_projects` -> pick a project -> `get_spaces` -> pick a space -> `get_charts` -> pick a chart -> `get_chart_results`. Each call burns context window tokens, adds latency, and creates opportunities for hallucination at every step.

**Why it happens:**
- It is the fastest path to "working" code -- just wrap each API endpoint
- Developers think of MCP tools like REST endpoints (resource-oriented) instead of agent actions (outcome-oriented)
- Lack of understanding that each tool invocation costs ~500-2000 tokens of overhead (tool description + parameters + response framing)

**How to avoid:**
1. **Design tools around user intents, not API resources** -- "get chart results by name" (one call) instead of "list projects" + "list spaces" + "list charts" + "get results" (four calls)
2. **Let the server orchestrate multi-API-call workflows internally** -- a single MCP tool can make 3-4 Lightdash API calls behind the scenes
3. **Cap at 9-15 tools total** -- the project scopes to 9 tools, which is well within the recommended 5-15 range
4. **Include optional filter parameters** so a single tool can serve multiple access patterns (e.g., `get_chart` accepts either `chartUuid` or `chartName`)
5. **Provide compound tools** for common workflows (e.g., `run_query` that accepts SQL + project context in one call)

**Warning signs:**
- LLM needs 3+ tool calls to accomplish a single user task
- Tools that are always called in sequence (indicating they should be merged)
- Tool responses that are only useful as input to the next tool call
- High token consumption per task despite small individual tool responses

**Phase to address:** Phase 1 (Foundation) -- tool API design must be outcome-oriented from the start. Changing tool interfaces after deployment breaks LLM prompts that reference specific tool names and parameters.

---

### Pitfall 5: No Request Timeout on Lightdash API Calls

**What goes wrong:**
Lightdash API calls (especially query execution endpoints) can hang for 30+ seconds or indefinitely if the Lightdash instance is under load, running a complex query, or experiencing network issues. Without timeouts, the MCP server blocks, the client times out waiting for a response, and the connection drops. The LLM gets no feedback and cannot recover.

**Why it happens:**
- `fetch()` and `axios` default to no timeout in Node.js
- Developers test against fast local Lightdash instances, never experiencing slow responses
- Query execution endpoints are fundamentally slower than metadata endpoints but get the same (zero) timeout

**How to avoid:**
1. **Set per-request timeouts on the HTTP client** -- 30 second default, configurable per endpoint:
   ```typescript
   const response = await fetch(url, {
     signal: AbortSignal.timeout(30_000),
     headers: { Authorization: `ApiKey ${apiKey}` },
   });
   ```
2. **Differentiate timeout by operation type** -- metadata lookups (5-10s), query execution (30-60s)
3. **Return a meaningful timeout error** via `isError: true` -- "Query timed out after 30 seconds. The query may be too complex or the Lightdash instance may be under load."
4. **Implement retry with backoff for transient failures** -- retry 5xx errors up to 2 times with exponential backoff, but never retry 4xx errors

**Warning signs:**
- MCP client shows "Request timed out" errors
- Server process consuming memory while waiting for responses
- Inconsistent tool behavior (works sometimes, hangs sometimes)
- No error returned -- the tool call just disappears

**Phase to address:** Phase 1 (Foundation) -- the HTTP client wrapper must include timeouts from day one. Adding timeouts later requires auditing every API call.

---

### Pitfall 6: Leaking Lightdash API Keys in Error Messages

**What goes wrong:**
When Lightdash API calls fail, error messages from HTTP libraries often include the full request URL and headers, which contain the API key. If these are passed through to the LLM via `isError` responses, the API key appears in the conversation context. The LLM may then include the key in its response to the user, or the key persists in conversation logs.

**Why it happens:**
- HTTP client libraries (fetch, axios) include request details in error objects
- Using `error.message` or `error.toString()` directly in tool error responses
- Lightdash URLs containing API keys as query parameters (some API patterns do this)
- Stack traces that include environment variables or config objects

**How to avoid:**
1. **Sanitize all error messages** before returning to the LLM -- strip URLs, headers, and any string matching API key patterns
2. **Create a dedicated error formatter** that extracts only safe fields:
   ```typescript
   function formatErrorForLLM(error: unknown): string {
     if (error instanceof LightdashApiError) {
       return `Lightdash API error: ${error.statusCode} - ${error.userMessage}`;
     }
     if (error instanceof Error) {
       return `Error: ${error.message.replace(/ApiKey\s+\S+/gi, 'ApiKey [REDACTED]')}`;
     }
     return "An unexpected error occurred.";
   }
   ```
3. **Log the full error to stderr** for debugging, but only return the sanitized version to the LLM
4. **Never include raw HTTP response bodies in error messages** -- extract only the Lightdash error message field

**Warning signs:**
- API keys appearing in Claude Desktop conversation transcripts
- Error messages containing URLs with auth tokens
- Full stack traces in tool error responses
- Error messages that mention internal hostnames or IP addresses

**Phase to address:** Phase 1 (Foundation) -- the error sanitizer must be built alongside the error handler wrapper. Every tool error goes through it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Passing through raw API responses | Fastest implementation | Token waste, LLM confusion, context overflow | Never -- always filter/shape responses |
| Hardcoding Lightdash URL in source | Quick local testing | Cannot configure per deployment | Never -- use environment variables from day one |
| Skipping Zod validation on tool inputs | Fewer lines of code | Runtime crashes from malformed LLM inputs; LLMs hallucinate parameter formats | Never -- the SDK requires Zod schemas anyway |
| Global mutable state in tool handlers | Simple data sharing | State leaks between calls, race conditions if concurrent | Never -- use request-scoped context |
| `any` types for API responses | Faster initial development | No compile-time safety, silent data shape changes | Only in prototype; replace within same phase |
| Single large try/catch for all tools | Less boilerplate | Cannot differentiate error types or provide targeted recovery hints | Never -- use per-tool error handling with shared utility |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Lightdash REST API | Using API key as query parameter | Pass API key via `Authorization: ApiKey {key}` header only |
| Lightdash REST API | Assuming consistent response shapes across versions | Validate response structure before accessing nested fields; Lightdash API is not versioned in URL |
| Lightdash REST API | Not handling `202 Accepted` for async operations | Check for async job IDs and poll for completion on query endpoints |
| MCP stdio transport | Assuming the SDK handles all stdout safety | The SDK handles its own output, but does NOT prevent your code or dependencies from polluting stdout |
| MCP SDK + Zod | Mixing Zod v3 and v4 in the dependency tree | Run `npm ls zod` to verify single version; SDK requires Zod v4 as a peer dependency |
| Node.js fetch | Not handling non-2xx responses | `fetch()` does not throw on 4xx/5xx -- you must check `response.ok` manually |
| Claude Desktop config | Incorrect `args` format in server configuration | Args must be an array of strings, not a single string; paths must be absolute |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Returning full query results without limits | Slow responses, context overflow | Always pass `limit` parameter to Lightdash query APIs; enforce max rows server-side | When queries return >100 rows (~10KB+ JSON) |
| No response caching for metadata | Repeated identical API calls for project/space/chart listings | Cache metadata responses for 60-300 seconds; Lightdash metadata changes infrequently during an MCP session | When LLM calls listing tools repeatedly in a conversation |
| Synchronous JSON serialization of large objects | Event loop blocking, client timeout | Stream large responses or pre-compute serialized output; use `JSON.stringify` with replacer to exclude unnecessary fields | When response objects exceed ~1MB |
| Creating new HTTP client per request | Connection overhead, TCP slow start | Reuse a single HTTP client instance with connection pooling (keep-alive) | Noticeable with >5 sequential tool calls |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API key in MCP server config file | Key in plaintext on disk, accessible to other processes | Read from environment variable; document that users set `LIGHTDASH_API_KEY` env var |
| Not validating Lightdash base URL format | SSRF if attacker controls the URL | Validate URL format and scheme (https only) at startup; reject non-URL values |
| Exposing internal Lightdash URLs in error messages | Information disclosure about infrastructure | Sanitize all error messages; never include full URLs in LLM-visible output |
| Running MCP server as root / elevated privileges | Compromise affects entire system | Run with minimal privileges; MCP servers need no special OS permissions |
| No input validation beyond Zod schema | SQL injection via query parameters passed to Lightdash API | Lightdash API handles its own SQL safety, but validate that user-provided strings do not contain unexpected characters for non-SQL fields |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Vague tool descriptions | LLM picks wrong tool or provides wrong arguments | Write descriptions as if teaching an agent when to use each tool: "Use this tool to list all charts in a Lightdash project. Returns chart names, UUIDs, and last-updated timestamps." |
| Tool names without `lightdash_` prefix | Ambiguous when user has multiple MCP servers | Prefix all tools: `lightdash_list_charts`, `lightdash_run_query`, etc. |
| Returning UUIDs without human-readable names | LLM must make additional calls to resolve UUIDs to names | Always include both UUID and name in responses |
| No tool for listing available projects | User must know project UUID to do anything | Provide a `lightdash_list_projects` tool as the starting point for discovery |
| Error messages without recovery guidance | LLM retries the same failing approach | Include suggestions: "Chart 'Revenue' not found in project X. Use lightdash_list_charts to see available charts." |
| Inconsistent response formats between tools | LLM cannot build reliable patterns for parsing responses | Use a consistent response structure: `{ items: [...], metadata: { total, has_more } }` for lists, `{ item: {...} }` for single resources |

## "Looks Done But Isn't" Checklist

- [ ] **Stdout purity:** Test by running server with a pipe to `jq` -- every line must parse as valid JSON. Check with both successful and error tool calls.
- [ ] **Error handling:** Trigger every error path (invalid project ID, expired API key, network timeout, rate limit) and verify `isError: true` responses, not protocol errors.
- [ ] **Response sizes:** Measure actual byte size of every tool response with realistic Lightdash data. A dev instance with 3 charts passes; production with 300 charts overflows.
- [ ] **Timeout behavior:** Test with an unreachable Lightdash URL to verify timeouts fire and return proper error messages.
- [ ] **API key safety:** Search all possible tool responses for the API key string. Trigger errors that include request details and verify the key is redacted.
- [ ] **Zod schema completeness:** Verify every tool parameter has a description (used by the LLM to understand the parameter) and appropriate constraints (min/max, enum values).
- [ ] **Process cleanup:** Verify the server shuts down cleanly on SIGINT/SIGTERM without zombie processes or hanging HTTP connections.
- [ ] **Empty results:** Test every tool with filters that return zero results. Verify the response says "No items found" rather than returning an empty object the LLM cannot interpret.
- [ ] **Connection lifecycle:** Start server, make calls, kill Lightdash API (simulate outage), make calls, restore API, make calls. Verify the MCP connection survives API outages.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stdout pollution deployed to production | LOW | Override `console.log` -> stderr at entry point; add eslint rule; add CI test. Single-file fix. |
| Massive payloads already in use by LLM prompts | MEDIUM | Add response filtering to each tool handler; may break existing prompts that depend on specific field names. Requires testing each tool. |
| Protocol errors instead of isError responses | LOW | Add try/catch wrapper to each tool handler. Can be done incrementally per tool. |
| 1:1 API mapping already shipped | HIGH | Changing tool interfaces breaks existing Claude Desktop configs and any prompts referencing old tool names/parameters. Requires deprecation period or version bump. |
| API key leaked in conversation logs | HIGH | Cannot un-leak. Must rotate the Lightdash API key immediately. Add sanitizer and audit all error paths. |
| No timeouts, server hanging in production | LOW | Add `AbortSignal.timeout()` to HTTP client. Single-file change in HTTP client wrapper. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stdout pollution | Phase 1: Foundation | CI test that pipes server output through JSON parser; eslint `no-console` rule |
| Massive payloads | Phase 1: Foundation (architecture) | Response size assertion tests: every tool response < 4KB with realistic data |
| Tool vs protocol errors | Phase 1: Foundation (error handling) | Integration test triggering each error path, asserting `isError: true` in response |
| 1:1 REST mapping | Phase 1: Foundation (tool design) | Code review checklist: each tool maps to a user intent, not an API endpoint |
| No request timeouts | Phase 1: Foundation (HTTP client) | Test with unreachable host; assert error returned within timeout period |
| API key leakage | Phase 1: Foundation (error handling) | Test that triggers API errors, then searches response text for the API key string |
| Zod version conflicts | Phase 1: Foundation (dependencies) | CI check: `npm ls zod` returns exactly one version |
| Third-party stdout pollution | Phase 1: Foundation (entry point) | Stdout intercept guard loaded before any imports; tested with mock polluting library |
| Missing response caching | Phase 2: Enhancement | Verify metadata tools make at most 1 API call per cache TTL window |
| No graceful shutdown | Phase 2: Enhancement | Kill server process during active request; verify no zombie processes |

## Sources

- [MCP Specification - Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) -- official spec on stdout/stderr separation for stdio transport (HIGH confidence)
- [MCP Specification - Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) -- official spec on `isError` flag behavior (HIGH confidence)
- [MCP Server Troubleshooting Guide](https://www.mcpstack.org/learn/mcp-server-troubleshooting-guide-2025) -- common connection errors and fixes (MEDIUM confidence)
- [NearForm - MCP Tips, Tricks and Pitfalls](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) -- comprehensive practitioner guide (MEDIUM confidence)
- [Phil Schmid - MCP Best Practices](https://www.philschmid.de/mcp-best-practices) -- tool design anti-patterns, the "6 best practices" (MEDIUM confidence)
- [Axiom - Designing MCP Servers for Wide Schemas](https://axiom.co/blog/designing-mcp-servers-for-wide-events) -- response size management, CSV token savings (MEDIUM confidence)
- [MCPcat - Error Handling Guide](https://mcpcat.io/guides/error-handling-custom-mcp-servers/) -- three-tier error model, isError vs protocol errors (MEDIUM confidence)
- [Octopus - MCP Timeout and Retry Strategies](https://octopus.com/blog/mcp-timeout-retry) -- retry patterns, circuit breakers (MEDIUM confidence)
- [ScaleKit - Should You Wrap MCP Around Your API?](https://www.scalekit.com/blog/wrap-mcp-around-existing-api) -- wrapper architecture patterns and anti-patterns (MEDIUM confidence)
- [GitHub Issue #142 - github-mcp-server](https://github.com/github/github-mcp-server/issues/142) -- real-world excessive response size issue (HIGH confidence)
- [GitHub Discussion #169224](https://github.com/orgs/community/discussions/169224) -- community discussion on large MCP responses (MEDIUM confidence)
- [cyanheads - MCP Server Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md) -- comprehensive development guide (MEDIUM confidence)
- [GitHub - modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) -- official TypeScript SDK, Zod dependency requirements (HIGH confidence)
- [GitHub Issue #796 - typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk/issues/796) -- Zod schema validation issues (HIGH confidence)
- [Nordic APIs - Why MCP Shouldn't Wrap an API One-to-One](https://nordicapis.com/why-mcp-shouldnt-wrap-an-api-one-to-one/) -- 5.3x tool invocation overhead from Queen's University research (MEDIUM confidence)

---
*Pitfalls research for: Lightdash MCP Server (TypeScript, stdio transport, REST API wrapper)*
*Researched: 2026-02-10*
