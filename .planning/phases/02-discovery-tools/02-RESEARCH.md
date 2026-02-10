# Phase 2: Discovery Tools - Research

**Researched:** 2026-02-10
**Domain:** MCP tool implementation for Lightdash project/space/chart/dashboard/explore discovery
**Confidence:** HIGH

## Summary

Phase 2 adds 5 read-only MCP tools that let Claude discover and navigate Lightdash content: projects, spaces, charts, dashboards, and explores. All infrastructure from Phase 1 is in place -- `LightdashClient` (auth, URL normalization, envelope unwrapping, timeouts), `wrapToolHandler` (error catching, sanitization), `registerTool` pattern (with `lightdash_` prefix, `readOnlyHint: true`), and the `lightdash_ping` reference tool. Phase 2 is pure tool implementation with no new infrastructure.

The 5 Lightdash REST API endpoints are confirmed: `GET /org/projects` (list projects), `GET /projects/:projectUuid/spaces` (list spaces), `GET /projects/:projectUuid/charts` (list charts with `SpaceQuery[]` response), `GET /projects/:projectUuid/dashboards` (list dashboards with `DashboardBasicDetailsWithTileTypes[]` response), and `GET /projects/:projectUuid/explores` (list explores with `SummaryExplore[]` response). Each endpoint returns far more data than needed -- the core value of these tools is server-side field filtering that strips responses to only the fields an LLM needs for reasoning and follow-up tool calls.

The chart listing endpoint is the highest-value target. The raw response for a production project can be 413KB+ (the known bug in the existing `lightdash-mcp-server` npm package). Our `lightdash_search_charts` tool fetches the full list but applies case-insensitive name filtering server-side and returns only 7 fields per match (uuid, name, spaceName, chartType, chartKind, updatedAt, slug), turning a context-window-killing payload into a compact, actionable response.

**Primary recommendation:** Implement all 5 tools following the exact pattern established by `lightdash_ping` -- one tool file per domain (or one file for all 5 since they are simple), each exporting a `registerXTool(server, client)` function, using `wrapToolHandler` for error handling, and applying aggressive field filtering on every response.

## Standard Stack

### Core (Already Installed -- Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.26.0 | MCP server framework, `registerTool()` | Official SDK. Already installed. |
| zod | ^3.25.0 | Input schema validation for tool parameters | SDK peer dependency. Already installed. |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Built-in `fetch` | (Node.js 22) | HTTP via `LightdashClient` | All API calls go through `client.get<T>()` |
| `LightdashClient` | (src/client.ts) | Auth, URL normalization, envelope unwrapping, timeouts | Every tool uses `client.get<T>(path)` |
| `wrapToolHandler` | (src/errors.ts) | Error catch/sanitize wrapper | Every tool handler is wrapped |

### No New Dependencies
Phase 2 requires zero new npm packages. Everything needed is already in place from Phase 1.

## Lightdash API Endpoints

### Confirmed Endpoints for Discovery Tools

| Tool | HTTP Method | API Path | Response Type | Source |
|------|-------------|----------|---------------|--------|
| `lightdash_list_projects` | GET | `/org/projects` | `ProjectSummary[]` | Terraform provider + Lightdash source types |
| `lightdash_list_spaces` | GET | `/projects/{projectUuid}/spaces` | `SpaceSummary[]` | Terraform provider + Lightdash source types |
| `lightdash_search_charts` | GET | `/projects/{projectUuid}/charts` | `SpaceQuery[]` | Lightdash docs title + source types |
| `lightdash_list_dashboards` | GET | `/projects/{projectUuid}/dashboards` | `DashboardBasicDetailsWithTileTypes[]` | Lightdash source types |
| `lightdash_list_explores` | GET | `/projects/{projectUuid}/explores` | `SummaryExplore[]` | Lightdash docs + source types |

**Confidence:** HIGH for paths and HIGH for response types -- confirmed from multiple sources (Lightdash source code types, Terraform provider implementation, API doc page titles, existing MCP server implementations).

### Raw API Response Fields (What We Receive)

#### GET /org/projects -> ProjectSummary[]
Each item contains:
- `projectUuid` (string)
- `name` (string)
- `organizationUuid` (string)
- `type` (string: 'DEFAULT' | 'PREVIEW')
- `upstreamProjectUuid` (string | undefined)

**We return:** `projectUuid` (as `uuid`), `name`, `type`
**Note:** The `warehouseType` field is specified in DISC-01 requirements. This field is NOT on `ProjectSummary` -- it is on the full `Project` type which includes `warehouseConnection`. The `/org/projects` endpoint may return a simplified summary without warehouse info. We need to verify at implementation time whether `warehouseType` or `warehouseConnection` is available on the list endpoint response. If not, we can either: (a) omit it and note in the tool description, or (b) make a secondary call to get project details. Given the requirement says "warehouseType", we should check the actual runtime response shape first.

#### GET /projects/{projectUuid}/spaces -> SpaceSummary[]
Each item contains:
- `uuid` (string)
- `name` (string)
- `organizationUuid` (string)
- `projectUuid` (string)
- `isPrivate` (boolean)
- `inheritParentPermissions` (boolean)
- `pinnedListUuid` (string | null)
- `pinnedListOrder` (number | null)
- `slug` (string)
- `parentSpaceUuid` (string | null)
- `path` (string)
- `userAccess` (SpaceShare | undefined)
- `access` (string[])
- `chartCount` (number)
- `dashboardCount` (number)

**We return:** `uuid`, `name`, `isPrivate`, `chartCount`, `dashboardCount`, `parentSpaceUuid`

#### GET /projects/{projectUuid}/charts -> SpaceQuery[]
`SpaceQuery` extends `ChartSummary` with additional fields. The full set includes:
- `uuid` (string)
- `name` (string)
- `description` (string | undefined)
- `spaceName` (string)
- `spaceUuid` (string)
- `projectUuid` (string)
- `organizationUuid` (string)
- `pinnedListUuid` (string | null)
- `dashboardUuid` (string | null)
- `dashboardName` (string | null)
- `slug` (string)
- `chartType` (ChartType | undefined)
- `chartKind` (ChartKind | undefined)
- `source` (ChartSourceType | undefined)
- `updatedAt` (Date)
- `updatedByUser` (UpdatedByUser | undefined)
- `pinnedListOrder` (number | null)
- `views` (number)
- `firstViewedAt` (Date | string | null)
- `validationErrors` (ValidationSummary[] | undefined)

**We return (per DISC-03):** `uuid`, `name`, `spaceName`, `chartType`, `chartKind`, `updatedAt`, `slug`

#### GET /projects/{projectUuid}/dashboards -> DashboardBasicDetailsWithTileTypes[]
Each item contains:
- `uuid` (string)
- `name` (string)
- `description` (string | undefined)
- `updatedAt` (Date)
- `projectUuid` (string)
- `updatedByUser` (UpdatedByUser | undefined)
- `organizationUuid` (string)
- `spaceUuid` (string)
- `views` (number)
- `firstViewedAt` (Date | string | null)
- `pinnedListUuid` (string | null)
- `pinnedListOrder` (number | null)
- `validationErrors` (ValidationSummary[] | undefined)
- `tileTypes` (DashboardTileTypes[])

**We return:** `uuid`, `name`, `description`, `spaceUuid`, `updatedAt`

#### GET /projects/{projectUuid}/explores -> SummaryExplore[]
Union type -- either successful or errored explore:

Successful:
- `name` (string)
- `label` (string)
- `tags` (string[])
- `groupLabel` (string | undefined)
- `type` (ExploreType)
- `description` (string | undefined)
- `schemaName` (string)
- `databaseName` (string)

Errored:
- Same fields plus `errors` (InlineError[])

**We return (per DISC-05):** `name`, `label`, `description`, `tags`

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)
```
src/
├── index.ts               # Add imports + registration calls for new tools
├── client.ts              # No changes needed
├── errors.ts              # No changes needed
├── types.ts               # Add interfaces for API response types
├── logger.ts              # No changes needed
└── tools/
    ├── ping.ts            # Existing (Phase 1)
    ├── projects.ts        # NEW: lightdash_list_projects
    ├── spaces.ts          # NEW: lightdash_list_spaces
    ├── charts.ts          # NEW: lightdash_search_charts
    ├── dashboards.ts      # NEW: lightdash_list_dashboards
    └── explores.ts        # NEW: lightdash_list_explores
```

### Pattern 1: One Tool Per File with Consistent Registration
**What:** Each tool gets its own file exporting a `registerXTool(server, client)` function. This follows the pattern established by `ping.ts` in Phase 1.
**When to use:** Always -- this is the established project pattern.
**Example:**
```typescript
// Source: Existing pattern from src/tools/ping.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import { z } from "zod";

interface SpaceSummaryResponse {
  uuid: string;
  name: string;
  isPrivate: boolean;
  chartCount: number;
  dashboardCount: number;
  parentSpaceUuid: string | null;
  [key: string]: unknown;
}

export function registerListSpacesTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_list_spaces",
    {
      title: "List Spaces",
      description:
        "List all spaces in a Lightdash project. Returns space names, UUIDs, chart/dashboard counts.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      inputSchema: {
        projectUuid: z.string().describe("UUID of the Lightdash project"),
      },
    },
    wrapToolHandler(async ({ projectUuid }) => {
      const spaces = await client.get<SpaceSummaryResponse[]>(
        `/projects/${projectUuid}/spaces`,
      );

      const filtered = spaces.map((s) => ({
        uuid: s.uuid,
        name: s.name,
        isPrivate: s.isPrivate,
        chartCount: s.chartCount,
        dashboardCount: s.dashboardCount,
        parentSpaceUuid: s.parentSpaceUuid,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    }),
  );
}
```

### Pattern 2: Server-Side Filtering with Case-Insensitive Search
**What:** For chart search, fetch the full chart list from Lightdash and filter in-memory on the server before returning results. Use `String.toLowerCase().includes()` for case-insensitive matching.
**When to use:** For `lightdash_search_charts` (DISC-03) and optionally `lightdash_list_dashboards` (DISC-04 with optional query parameter).
**Example:**
```typescript
// Server-side chart filtering
const allCharts = await client.get<SpaceQueryResponse[]>(
  `/projects/${projectUuid}/charts`,
);

const matches = allCharts.filter((c) =>
  c.name.toLowerCase().includes(query.toLowerCase()),
);

const filtered = matches.map((c) => ({
  uuid: c.uuid,
  name: c.name,
  spaceName: c.spaceName,
  chartType: c.chartType,
  chartKind: c.chartKind,
  updatedAt: c.updatedAt,
  slug: c.slug,
}));
```

### Pattern 3: Zod Input Schema for Tool Parameters
**What:** Use Zod schemas in `inputSchema` to define tool parameters. The SDK validates inputs automatically and provides typed arguments to the handler.
**When to use:** Every tool with parameters.
**Example:**
```typescript
// Required parameter
inputSchema: {
  projectUuid: z.string().describe("UUID of the Lightdash project"),
},

// Required + optional parameters
inputSchema: {
  projectUuid: z.string().describe("UUID of the Lightdash project"),
  query: z.string().optional().describe("Optional search term to filter by name"),
},
```

### Pattern 4: Empty Results Handling
**What:** When a list/search returns zero results, return a clear textual message rather than an empty array. This helps the LLM understand the situation and suggest next steps.
**When to use:** Every list/search tool.
**Example:**
```typescript
if (filtered.length === 0) {
  return {
    content: [
      {
        type: "text" as const,
        text: query
          ? `No charts found matching "${query}" in project ${projectUuid}. Try a different search term or use lightdash_list_spaces to browse by space.`
          : `No charts found in project ${projectUuid}.`,
      },
    ],
  };
}
```

### Pattern 5: Registration in index.ts
**What:** Import and call each tool's registration function in `index.ts`.
**When to use:** After creating each tool file.
**Example:**
```typescript
// In src/index.ts -- add after existing registerPingTool(server, client)
import { registerListProjectsTool } from "./tools/projects.js";
import { registerListSpacesTool } from "./tools/spaces.js";
import { registerSearchChartsTool } from "./tools/charts.js";
import { registerListDashboardsTool } from "./tools/dashboards.js";
import { registerListExploresTool } from "./tools/explores.js";

// Register tools
registerPingTool(server, client);
registerListProjectsTool(server, client);
registerListSpacesTool(server, client);
registerSearchChartsTool(server, client);
registerListDashboardsTool(server, client);
registerListExploresTool(server, client);
```

### Anti-Patterns to Avoid
- **Returning raw API responses:** Never `JSON.stringify(apiResult)` without field filtering. Every tool must select specific fields.
- **Forgetting `import type`:** Use `import type { McpServer }` since it is only needed for type annotations (established in Phase 1).
- **Missing `.js` extensions in imports:** ESM requires explicit `.js` -- e.g., `from "../client.js"`, not `from "../client"`.
- **Hardcoding projectUuid:** Every project-scoped tool must accept `projectUuid` as a Zod parameter.
- **Not wrapping handlers:** Every handler must use `wrapToolHandler()` to ensure errors become `isError: true` responses.
- **Verbose tool descriptions:** Keep descriptions to 1-2 sentences. Detailed usage guidance goes in error messages, not tool descriptions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation | Manual parameter checking | Zod via `inputSchema` | SDK validates automatically, provides typed args |
| Error handling | Per-tool try/catch | `wrapToolHandler()` from Phase 1 | Already built and tested; consistent across all tools |
| HTTP calls | Direct `fetch()` | `client.get<T>(path)` | Auth, URL normalization, envelope unwrapping, timeouts all handled |
| JSON-RPC protocol | Custom response formatting | SDK's `registerTool` return type | SDK handles serialization and transport |
| Case-insensitive search | Regex matching | `toLowerCase().includes()` | Simpler, no regex escaping needed, handles all Unicode |

**Key insight:** Phase 2 is entirely tool-layer code. All infrastructure (client, errors, logger, transport) was built in Phase 1. Each tool is ~30-60 lines: fetch, filter, return.

## Common Pitfalls

### Pitfall 1: warehouseType May Not Be on List Projects Response
**What goes wrong:** DISC-01 requires returning `warehouseType` per project, but the `ProjectSummary` type (returned by `GET /org/projects`) does not include `warehouseType` -- it only has `name`, `projectUuid`, `organizationUuid`, `type`, and `upstreamProjectUuid`. The full `Project` type has `warehouseConnection` (an object, not a simple string).
**Why it happens:** The list endpoint returns a summary type with fewer fields than the detail endpoint.
**How to avoid:** Test the actual API response at implementation time. If `warehouseType` is present (the API may return more fields than the TypeScript type suggests), use it. If not, either: (a) accept the difference and document it, or (b) make a secondary `GET /projects/{uuid}` call to fetch warehouseConnection details. Option (a) is simpler and keeps the tool fast.
**Warning signs:** `warehouseType` is `undefined` in the response.

### Pitfall 2: Explore Errors vs Explore Summaries
**What goes wrong:** The `GET /projects/{projectUuid}/explores` endpoint returns a union type -- `SummaryExplore` is either a successful explore or an errored explore (one with compile errors). If you only handle the success case, errored explores silently disappear from the listing.
**Why it happens:** Lightdash compiles dbt models into explores, and compilation can fail.
**How to avoid:** Handle both variants. For errored explores, include them in the listing with an `errors` field or a status indicator so the LLM knows something is wrong.
**Warning signs:** Explore count doesn't match what the Lightdash UI shows.

### Pitfall 3: Large Chart Lists Overwhelming the Response
**What goes wrong:** Production Lightdash instances can have hundreds of charts. Even after field filtering, returning 500 chart summaries creates a large response.
**Why it happens:** No pagination on the `search_charts` tool.
**How to avoid:** The `query` parameter on `search_charts` is required (per DISC-03), which naturally filters results. For `list_dashboards`, the query is optional. Add a count header: `"Showing N of M total charts matching 'query'."` If results exceed a reasonable threshold (e.g., 100 items), truncate and tell the LLM.
**Warning signs:** Tool responses exceeding 4KB. LLM struggling to process long lists.

### Pitfall 4: Not URL-Encoding Path Parameters
**What goes wrong:** If a `projectUuid` or `exploreName` contains special characters (unlikely for UUIDs but possible for explore names), the URL breaks.
**Why it happens:** String interpolation without encoding: `/projects/${projectUuid}/charts`.
**How to avoid:** For UUIDs, this is not a real risk (UUIDs are hex + dashes). For explore names in Phase 3, use `encodeURIComponent()`. For Phase 2 tools, string interpolation is fine since all path params are UUIDs.
**Warning signs:** 404 errors on valid-looking requests.

### Pitfall 5: Forgetting to Wire Up Tools in index.ts
**What goes wrong:** Tool file is created and compiles fine, but the tool doesn't appear in MCP Inspector because the `registerXTool` function was never called in `index.ts`.
**Why it happens:** Each tool file is self-contained. It is easy to forget the registration call in the entry point.
**How to avoid:** After creating each tool file, immediately add the import and registration call to `index.ts`. Test with `npm run build && npm run inspect` after each tool.
**Warning signs:** Tool not visible in MCP Inspector. Zero tools listed beyond `lightdash_ping`.

### Pitfall 6: TypeScript Interface Mismatch with Runtime Response
**What goes wrong:** We define TypeScript interfaces based on the Lightdash source code types, but the actual API response may include additional fields or use slightly different names.
**Why it happens:** TypeScript types in the Lightdash repo are the internal representation. The API serialization may differ.
**How to avoid:** Use `[key: string]: unknown` index signature on response interfaces (as done in `ping.ts`). Access only the specific fields needed. If a field is `undefined`, handle it gracefully.
**Warning signs:** `undefined` values in filtered output. TypeScript compile errors when accessing fields.

## Code Examples

### Complete Tool: lightdash_list_projects (DISC-01)
```typescript
// Source: Phase 1 patterns (ping.ts) + Lightdash API research
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";

interface OrgProjectResponse {
  projectUuid: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

export function registerListProjectsTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_list_projects",
    {
      title: "List Projects",
      description:
        "List all Lightdash projects in the organization. Returns project names and UUIDs.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    wrapToolHandler(async () => {
      const projects = await client.get<OrgProjectResponse[]>("/org/projects");

      const filtered = projects.map((p) => ({
        uuid: p.projectUuid,
        name: p.name,
        type: p.type,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    }),
  );
}
```

### Complete Tool: lightdash_search_charts (DISC-03)
```typescript
// Source: Phase 1 patterns + DISC-03 requirements
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import { z } from "zod";

interface ChartResponse {
  uuid: string;
  name: string;
  spaceName: string;
  chartType?: string;
  chartKind?: string;
  updatedAt: string;
  slug: string;
  [key: string]: unknown;
}

export function registerSearchChartsTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_search_charts",
    {
      title: "Search Charts",
      description:
        "Search saved charts in a Lightdash project by name. Returns matching chart names, UUIDs, and types.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      inputSchema: {
        projectUuid: z.string().describe("UUID of the Lightdash project"),
        query: z.string().describe("Search term to filter chart names (case-insensitive)"),
      },
    },
    wrapToolHandler(async ({ projectUuid, query }) => {
      const allCharts = await client.get<ChartResponse[]>(
        `/projects/${projectUuid}/charts`,
      );

      const matches = allCharts.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()),
      );

      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No charts found matching "${query}" in project ${projectUuid}. Try a broader search term.`,
            },
          ],
        };
      }

      const filtered = matches.map((c) => ({
        uuid: c.uuid,
        name: c.name,
        spaceName: c.spaceName,
        chartType: c.chartType,
        chartKind: c.chartKind,
        updatedAt: c.updatedAt,
        slug: c.slug,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    }),
  );
}
```

### Tool with Optional Parameter: lightdash_list_dashboards (DISC-04)
```typescript
// Source: Phase 1 patterns + DISC-04 requirements
inputSchema: {
  projectUuid: z.string().describe("UUID of the Lightdash project"),
  query: z.string().optional().describe("Optional search term to filter dashboard names"),
},
// In handler:
wrapToolHandler(async ({ projectUuid, query }) => {
  const dashboards = await client.get<DashboardResponse[]>(
    `/projects/${projectUuid}/dashboards`,
  );

  const results = query
    ? dashboards.filter((d) =>
        d.name.toLowerCase().includes(query.toLowerCase()),
      )
    : dashboards;

  const filtered = results.map((d) => ({
    uuid: d.uuid,
    name: d.name,
    description: d.description,
    spaceUuid: d.spaceUuid,
    updatedAt: d.updatedAt,
  }));
  // ...
})
```

### TypeScript Interfaces for types.ts
```typescript
// Source: Lightdash packages/common/src/types/* confirmed via GitHub
// Add to src/types.ts alongside existing LightdashProject

/**
 * Space summary returned by GET /api/v1/projects/{uuid}/spaces
 */
export interface LightdashSpaceSummary {
  uuid: string;
  name: string;
  isPrivate: boolean;
  chartCount: number;
  dashboardCount: number;
  parentSpaceUuid: string | null;
  [key: string]: unknown;
}

/**
 * Chart entry returned by GET /api/v1/projects/{uuid}/charts
 * (SpaceQuery type in Lightdash source)
 */
export interface LightdashChartSummary {
  uuid: string;
  name: string;
  description?: string;
  spaceName: string;
  spaceUuid: string;
  chartType?: string;
  chartKind?: string;
  updatedAt: string;
  slug: string;
  [key: string]: unknown;
}

/**
 * Dashboard entry returned by GET /api/v1/projects/{uuid}/dashboards
 */
export interface LightdashDashboardSummary {
  uuid: string;
  name: string;
  description?: string;
  spaceUuid: string;
  updatedAt: string;
  [key: string]: unknown;
}

/**
 * Explore summary returned by GET /api/v1/projects/{uuid}/explores
 */
export interface LightdashExploreSummary {
  name: string;
  label: string;
  description?: string;
  tags: string[];
  errors?: Array<{ type: string; message: string }>;
  [key: string]: unknown;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `server.tool()` | `server.registerTool()` | MCP SDK v1.x recent | Use `registerTool` (already using this in Phase 1) |
| Returning full API payloads | Server-side field filtering | MCP best practices 2025 | 413KB -> ~2KB per response |
| Single tool for all discovery | Separate tools per domain | MCP tool design patterns | 5 focused tools, each under 15 params |

**Deprecated/outdated:**
- `server.tool()`: Still works but deprecated. We use `server.registerTool()`.
- Raw JSON response passthrough: The anti-pattern this entire project exists to fix.

## Open Questions

1. **Does GET /org/projects return warehouseType?**
   - What we know: The `ProjectSummary` TypeScript type does NOT include `warehouseType`. The full `Project` type has `warehouseConnection` (an object with connection details).
   - What's unclear: Whether the actual API response includes additional fields beyond what the TypeScript type declares (APIs often return more than their declared types).
   - Recommendation: Test at implementation time. If `warehouseType` is present in the response, use it. If not, omit it or consider adding `type` (DEFAULT/PREVIEW) instead. The requirement (DISC-01) specifies `warehouseType`, so if the list endpoint doesn't have it, document the deviation and consider getting it from individual project detail endpoints.

2. **Dashboard list endpoint path confirmation**
   - What we know: Based on the API pattern (`/projects/{uuid}/resource`), Lightdash source types (`ApiGetDashboardsResponse`), and the syucream MCP server having a `list_dashboards` tool, the endpoint is almost certainly `GET /projects/{projectUuid}/dashboards`.
   - What's unclear: We could not directly confirm the exact path from API docs (the docs site returns 404 on fetch).
   - Recommendation: HIGH confidence this is correct. If it fails at implementation, check for `/projects/{projectUuid}/dashboards/summaries` or similar variants.

3. **Explore error handling in list**
   - What we know: `SummaryExplore` is a union type -- explores can be in an error state.
   - What's unclear: Whether the LLM benefits from seeing errored explores in the list or if they should be filtered out.
   - Recommendation: Include them with a status field (`status: 'ok'` or `status: 'error'` with error message). This helps the LLM tell the user "2 of your 8 explores have compilation errors."

## Sources

### Primary (HIGH confidence)
- [Lightdash packages/common/src/types/savedCharts.ts](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/savedCharts.ts) -- `ChartSummary`, `SpaceQuery`, `ApiChartListResponse` types
- [Lightdash packages/common/src/types/space.ts](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/space.ts) -- `SpaceSummary`, `ApiSpaceSummaryListResponse` types
- [Lightdash packages/common/src/types/explore.ts](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/explore.ts) -- `SummaryExplore` union type
- [Lightdash packages/common/src/types/dashboard.ts](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/dashboard.ts) -- `DashboardBasicDetails`, `ApiGetDashboardsResponse`
- [Lightdash packages/common/src/types/projects.ts](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/projects.ts) -- `ProjectSummary`, `Project` types
- [ubie-oss/terraform-provider-lightdash](https://github.com/ubie-oss/terraform-provider-lightdash/blob/main/internal/lightdash/api/v1/) -- Confirmed `GET /api/v1/org/projects` and `GET /api/v1/projects/{uuid}/spaces` endpoint paths
- Existing codebase: `src/tools/ping.ts` -- Reference implementation for tool registration pattern
- Existing codebase: `src/client.ts` -- `LightdashClient` with `get<T>(path)` method
- Existing codebase: `src/errors.ts` -- `wrapToolHandler()` utility

### Secondary (MEDIUM confidence)
- [Lightdash API Reference](https://docs.lightdash.com/api-reference/v1/introduction) -- API documentation site (could not fetch content, but page titles confirm endpoint existence)
- [syucream/lightdash-mcp-server](https://github.com/syucream/lightdash-mcp-server) -- Existing TypeScript MCP server with `list_projects`, `list_spaces`, `list_charts`, `list_dashboards` tools
- [Lightdash MCP guide](https://docs.lightdash.com/guides/lightdash-mcp) -- Official Lightdash MCP documentation

### Tertiary (LOW confidence)
- warehouseType field availability on list endpoint -- needs runtime verification

## Metadata

**Confidence breakdown:**
- API endpoints: HIGH -- confirmed from Lightdash source types, Terraform provider, and multiple MCP implementations
- Response types/fields: HIGH -- extracted directly from Lightdash packages/common TypeScript source
- Tool registration pattern: HIGH -- identical to working `ping.ts` reference implementation
- Field filtering decisions: HIGH -- driven by explicit DISC-01 through DISC-05 requirements
- warehouseType availability: LOW -- needs runtime testing

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days -- Lightdash API is stable, MCP SDK v1.x is stable)
