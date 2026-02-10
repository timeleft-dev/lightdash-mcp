# Phase 3: Data Access & Deployment - Research

**Researched:** 2026-02-10
**Domain:** Lightdash data access APIs (chart config, chart results, explore schema, ad-hoc queries) + MCP server deployment for Claude Desktop
**Confidence:** HIGH

## Summary

Phase 3 adds 4 data access tools and completes the build/deploy pipeline. The 4 tools let Claude retrieve saved chart configurations, execute saved charts, inspect full explore schemas (dimensions, metrics, joins), and run ad-hoc queries using native Lightdash filter/sort format. The deployment story is a simple shell script that copies `build/` and production `node_modules/` to `~/lightdash-mcp/`, plus documented Claude Desktop `mcpServers` JSON configuration.

All 4 Lightdash API endpoints are confirmed from the Lightdash source code and official API documentation: `GET /saved/{chartUuid}` returns the full `SavedChart` object (metricQuery, chartConfig, tableName); `POST /saved/{chartUuid}/results` executes the chart's saved query and returns rows/fields; `GET /projects/{projectUuid}/explores/{exploreId}` returns the compiled explore with tables, dimensions, metrics, and joins; and `POST /projects/{projectUuid}/explores/{exploreId}/runQuery` accepts a `MetricQueryRequest` body (dimensions, metrics, filters, sorts, limit, tableCalculations) and returns rows/fields. The filter format uses nested `AndFilterGroup`/`OrFilterGroup` structures with `FilterRule` objects containing `target.fieldId`, `operator` (from `FilterOperator` enum), and `values[]`.

The existing codebase from Phase 1+2 provides everything needed: `LightdashClient` with `get<T>()` and `post<T>()` methods, `wrapToolHandler` for error catching, Zod for input validation, the `registerXTool(server, client)` pattern, and 6 working tools as reference implementations. Phase 3 introduces two new patterns: (1) tools that return potentially large result sets (chart results and query results with row data), requiring row count limits and truncation; and (2) the `post<T>()` client method used for the first time (chart results and run query).

**Primary recommendation:** Implement the 4 data tools following the exact established patterns, add TypeScript interfaces for SavedChart and Explore response types, use the `post<T>()` method for result execution endpoints, apply server-side field filtering and row truncation on result responses, and create a deploy.sh script that runs `npm ci --omit=dev && npm run build` then copies to `~/lightdash-mcp/`.

## Standard Stack

### Core (Already Installed -- Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.26.0 | MCP server framework, `registerTool()` | Official SDK. Already installed. |
| zod | ^3.25.0 | Input schema validation for tool parameters | SDK peer dependency. Already installed. |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Built-in `fetch` | (Node.js 22) | HTTP via `LightdashClient` | All API calls via `client.get<T>()` and `client.post<T>()` |
| `LightdashClient` | (src/client.ts) | Auth, URL normalization, envelope unwrapping, timeouts | Every tool uses client methods |
| `wrapToolHandler` | (src/errors.ts) | Error catch/sanitize wrapper | Every tool handler is wrapped |

### No New Dependencies
Phase 3 requires zero new npm packages. The deploy script uses only bash built-ins (`mkdir`, `cp`, `rm`) and npm commands.

## Lightdash API Endpoints

### Confirmed Endpoints for Data Access Tools

| Tool | HTTP Method | API Path | Request Body | Response Type | Source |
|------|-------------|----------|-------------|---------------|--------|
| `lightdash_get_chart` | GET | `/saved/{chartUuid}` | None | `SavedChart` | Lightdash savedChartRouter.ts -- `GET /:savedQueryUuidOrSlug` |
| `lightdash_get_chart_results` | POST | `/saved/{chartUuid}/results` | `{ invalidateCache?: boolean }` | `{ rows, fields, metricQuery, cacheMetadata }` | Lightdash API docs -- Run chart query |
| `lightdash_get_explore` | GET | `/projects/{projectUuid}/explores/{exploreId}` | None | `Explore` (tables, dimensions, metrics, joins) | Lightdash API docs -- Get explore |
| `lightdash_run_raw_query` | POST | `/projects/{projectUuid}/explores/{exploreId}/runQuery` | `MetricQueryRequest` | `{ rows, fields, metricQuery, cacheMetadata }` | Lightdash API docs -- Run metric query |

**Confidence:** HIGH -- all endpoints confirmed from both Lightdash source code (GitHub) and official API documentation.

**Note on deprecation:** The `POST /saved/{chartUuid}/results` and `POST /saved/{chartUuid}/chart-and-results` endpoints are marked deprecated in the API docs. A v2 async query API exists (`POST /api/v2/saved/{chartUuid}/results-async`), but the v1 sync endpoints still work and are simpler for MCP use (synchronous request/response fits the MCP tool model). Use v1 for now; migrate to v2 if v1 is removed.

### Endpoint 1: GET /saved/{chartUuid} -- Chart Configuration

**Path:** `GET /api/v1/saved/{savedQueryUuidOrSlug}`
**Source:** Lightdash `savedChartRouter.ts` route handler

**Response type:** `SavedChart` with these fields:
```typescript
{
  uuid: string;
  projectUuid: string;
  name: string;
  description?: string;
  tableName: string;                    // Base explore table
  metricQuery: MetricQuery;             // Full query definition
  chartConfig: ChartConfig;             // Visualization config (type, axes, etc.)
  tableConfig: { columnOrder: string[] };
  pivotConfig?: { columns: string[] };
  updatedAt: Date;
  updatedByUser?: UpdatedByUser;
  organizationUuid: string;
  spaceUuid: string;
  spaceName: string;
  dashboardUuid: string | null;
  dashboardName: string | null;
  colorPalette: string[];
  slug: string;
  isPrivate: boolean;
  access: SpaceShare[];
  pinnedListUuid: string | null;
  pinnedListOrder: number | null;
}
```

**Fields to return (filtered):**
- `uuid`, `name`, `description`, `tableName`, `spaceName`
- `metricQuery` (dimensions, metrics, filters, sorts, limit -- the query definition)
- `chartConfig.type` (chart type: CARTESIAN, TABLE, BIG_NUMBER, PIE, etc.)

**Fields to omit:** `organizationUuid`, `projectUuid`, `colorPalette`, `access`, `isPrivate`, `pinnedListUuid`, `pinnedListOrder`, `updatedByUser`, full `chartConfig` details (axes config, series config -- too verbose for LLM)

### Endpoint 2: POST /saved/{chartUuid}/results -- Execute Saved Chart

**Path:** `POST /api/v1/saved/{chartUuid}/results`
**Request body:** `{ invalidateCache?: boolean }` (optional, default false)

**Response:**
```typescript
{
  metricQuery: MetricQueryResponse;     // The query that was executed
  rows: Record<string, { value: { raw: any; formatted: string } }>[];
  fields: Record<string, FieldInfo>;    // Field metadata
  cacheMetadata: {
    cacheHit: boolean;
    cacheKey?: string;
    cacheExpiresAt?: string;
    cacheUpdatedTime?: string;
  };
}
```

**Fields to return (filtered):**
- `rows` (truncated to limit, with only `raw` values for compactness)
- `fields` (field names as column headers)
- Row count info: "Showing N of M rows"

**Row truncation:** Return at most 500 rows. If the result set is larger, include a message indicating truncation.

### Endpoint 3: GET /projects/{projectUuid}/explores/{exploreId} -- Explore Schema

**Path:** `GET /api/v1/projects/{projectUuid}/explores/{exploreId}`
**Note:** The `exploreId` parameter is the explore `name` (the string returned by `lightdash_list_explores`), not a UUID.

**Response type:** `Explore` (compiled explore):
```typescript
{
  name: string;
  label: string;
  baseTable: string;
  tags: string[];
  targetDatabase: SupportedDbtAdapter;   // bigquery, snowflake, postgres, etc.
  tables: Record<string, CompiledTable>; // Table name -> table with dims/metrics
  joinedTables: CompiledExploreJoin[];   // Join definitions
  type?: "virtual" | "default";
  groupLabel?: string;
  warehouse?: string;
  ymlPath?: string;
  sqlPath?: string;
  aiHint?: string | string[];
}
```

**CompiledTable:**
```typescript
{
  name: string;
  label: string;
  description?: string;
  sqlTable: string;
  schema: string;
  database: string;
  dimensions: Record<string, CompiledDimension>;
  metrics: Record<string, CompiledMetric>;
  // ... other fields
}
```

**CompiledDimension key fields:**
- `name`, `label`, `table`, `type` (string|number|timestamp|date|boolean)
- `description`, `sql`, `compiledSql`, `hidden`, `timeInterval`

**CompiledMetric key fields:**
- `name`, `label`, `table`, `type` (percentile|average|count|count_distinct|sum|min|max|etc.)
- `description`, `sql`, `compiledSql`, `hidden`, `filters`

**CompiledExploreJoin key fields:**
- `table`, `sqlOn`, `compiledSqlOn`
- `type` (inner|full|left|right), `relationship` (one-to-many|many-to-one|one-to-one|many-to-many)
- `hidden`, `always`

**Fields to return (filtered):**
- `name`, `label`, `baseTable`, `tags`
- For each table: name, label, description, and for each dimension/metric: name, label, type, description (omit hidden fields, sql, compiledSql)
- Joins: table, type, relationship
- This is the one tool where we return MORE data since the whole point is to expose the schema for query construction. Still filter out internal/SQL fields.

### Endpoint 4: POST /projects/{projectUuid}/explores/{exploreId}/runQuery -- Ad-hoc Query

**Path:** `POST /api/v1/projects/{projectUuid}/explores/{exploreId}/runQuery`

**Request body -- MetricQueryRequest:**
```typescript
{
  exploreName: string;          // Must match exploreId in URL
  dimensions: FieldId[];        // e.g., ["orders_created_date", "customers_name"]
  metrics: FieldId[];           // e.g., ["orders_total_revenue", "orders_count"]
  filters: Filters;             // Native Lightdash filter format (see below)
  sorts: SortField[];           // e.g., [{ fieldId: "orders_total_revenue", descending: true }]
  limit: number;                // e.g., 500
  tableCalculations: TableCalculation[]; // Usually empty []
  // Optional:
  additionalMetrics?: AdditionalMetric[];
  customDimensions?: CustomDimension[];
  csvLimit?: number;
  timezone?: string;
}
```

**Response:** Same shape as chart results -- `{ rows, fields, metricQuery, cacheMetadata }`

**Timeout:** Use 60s timeout for query execution (override the 30s default).

## Filter & Sort Format (Native Lightdash)

### FilterOperator Enum
```typescript
enum FilterOperator {
  NULL = 'isNull',
  NOT_NULL = 'notNull',
  EQUALS = 'equals',
  NOT_EQUALS = 'notEquals',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  INCLUDE = 'include',
  NOT_INCLUDE = 'doesNotInclude',
  LESS_THAN = 'lessThan',
  LESS_THAN_OR_EQUAL = 'lessThanOrEqual',
  GREATER_THAN = 'greaterThan',
  GREATER_THAN_OR_EQUAL = 'greaterThanOrEqual',
  IN_THE_PAST = 'inThePast',
  NOT_IN_THE_PAST = 'notInThePast',
  IN_THE_NEXT = 'inTheNext',
  IN_THE_CURRENT = 'inTheCurrent',
  NOT_IN_THE_CURRENT = 'notInTheCurrent',
  IN_BETWEEN = 'inBetween',
  NOT_IN_BETWEEN = 'notInBetween',
}
```

### Filter Structure
```typescript
// Top-level Filters object
type Filters = {
  dimensions?: FilterGroup;
  metrics?: FilterGroup;
  tableCalculations?: FilterGroup;
};

// FilterGroup is either AND or OR
type AndFilterGroup = { id: string; and: FilterGroupItem[] };
type OrFilterGroup = { id: string; or: FilterGroupItem[] };
type FilterGroup = AndFilterGroup | OrFilterGroup;
type FilterGroupItem = FilterGroup | FilterRule;

// Individual filter rule
interface FilterRule {
  id: string;
  target: { fieldId: string };
  operator: FilterOperator;  // e.g., 'equals', 'greaterThan', 'inThePast'
  values?: any[];            // e.g., [100], ['active'], [30]
  settings?: any;            // e.g., { unitOfTime: 'days' } for date filters
  disabled?: boolean;
  required?: boolean;
}
```

### SortField
```typescript
interface SortField {
  fieldId: string;    // e.g., "orders_total_revenue"
  descending: boolean;
  nullsFirst?: boolean;
}
```

### Filter Example
```typescript
// Example: orders created in last 30 days with revenue > 100
const filters: Filters = {
  dimensions: {
    id: "dim-filter-group",
    and: [
      {
        id: "date-filter",
        target: { fieldId: "orders_created_date" },
        operator: "inThePast",
        values: [30],
        settings: { unitOfTime: "days" },
      },
    ],
  },
  metrics: {
    id: "metric-filter-group",
    and: [
      {
        id: "revenue-filter",
        target: { fieldId: "orders_total_revenue" },
        operator: "greaterThan",
        values: [100],
      },
    ],
  },
};
```

**Source:** Lightdash `packages/common/src/types/filter.ts` and `packages/common/src/types/metricQuery.ts` (HIGH confidence -- direct source code)

## Architecture Patterns

### Recommended Project Structure (additions to Phase 2)
```
src/
  index.ts                # Add 4 new tool registrations
  client.ts               # No changes needed (get + post already exist)
  errors.ts               # No changes needed
  types.ts                # Add SavedChart, Explore, MetricQueryRequest types
  logger.ts               # No changes needed
  tools/
    ping.ts               # Existing (Phase 1)
    projects.ts           # Existing (Phase 2)
    spaces.ts             # Existing (Phase 2)
    charts.ts             # Existing: search_charts; ADD: get_chart
    dashboards.ts         # Existing (Phase 2)
    explores.ts           # Existing: list_explores; ADD: get_explore
    query.ts              # NEW: run_raw_query
    chart-results.ts      # NEW: get_chart_results
deploy.sh                 # NEW: Build and deploy script
```

### Pattern 1: Tool File Organization -- Co-locate Related Tools
**What:** Group related tools in the same file when they share domain context. `lightdash_get_chart` goes in `charts.ts` alongside `lightdash_search_charts`. `lightdash_get_explore` goes in `explores.ts` alongside `lightdash_list_explores`.
**When to use:** When a new tool operates on the same domain entity as an existing tool.
**Why:** Keeps related types and response interfaces co-located. Follows the single-file-per-domain pattern from Phase 2.

### Pattern 2: POST Tool with Request Body
**What:** Use `client.post<T>(path, body, timeoutMs)` for tools that execute queries. Pass the body as a plain object.
**When to use:** `lightdash_get_chart_results` and `lightdash_run_raw_query`.
**Example:**
```typescript
// Source: Existing client.post<T>() method in src/client.ts
const results = await client.post<QueryResultsResponse>(
  `/saved/${chartUuid}/results`,
  { invalidateCache: false },
  60_000, // 60s timeout for query execution
);
```

### Pattern 3: Row Truncation for Result Sets
**What:** Limit the number of rows returned to avoid overwhelming the LLM context window. Include metadata about the full result set.
**When to use:** Any tool returning query result rows.
**Example:**
```typescript
const MAX_ROWS = 500;
const allRows = results.rows;
const truncated = allRows.length > MAX_ROWS;
const rows = allRows.slice(0, MAX_ROWS);

// Simplify row values: extract raw values only
const simpleRows = rows.map((row) => {
  const simplified: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    simplified[key] = val.value?.raw ?? val.value;
  }
  return simplified;
});

const response: any = {
  columns: Object.keys(results.fields),
  rows: simpleRows,
  rowCount: allRows.length,
};
if (truncated) {
  response.truncated = true;
  response.message = `Showing ${MAX_ROWS} of ${allRows.length} rows`;
}
```

### Pattern 4: Explore Schema Filtering
**What:** The full explore response is deeply nested with SQL and internal fields. Filter to show only what an LLM needs to construct queries: field names, labels, types, descriptions.
**When to use:** `lightdash_get_explore` tool.
**Example:**
```typescript
// Filter dimensions and metrics from explore tables
function filterTable(table: CompiledTable) {
  const dimensions = Object.values(table.dimensions)
    .filter((d) => !d.hidden)
    .map((d) => ({
      name: d.name,
      label: d.label,
      type: d.type,
      description: d.description,
    }));
  const metrics = Object.values(table.metrics)
    .filter((m) => !m.hidden)
    .map((m) => ({
      name: m.name,
      label: m.label,
      type: m.type,
      description: m.description,
    }));
  return { name: table.name, label: table.label, description: table.description, dimensions, metrics };
}
```

### Pattern 5: Zod Schema for Complex Input (runQuery)
**What:** Use nested Zod schemas for the run_raw_query tool's filter and sort parameters. Accept native Lightdash format as passthrough JSON.
**When to use:** `lightdash_run_raw_query` tool.
**Example:**
```typescript
inputSchema: {
  projectUuid: z.string().describe("UUID of the Lightdash project"),
  exploreName: z.string().describe("Name of the explore (from lightdash_list_explores or lightdash_get_explore)"),
  dimensions: z.array(z.string()).describe("Array of dimension field IDs to include (e.g., ['orders_created_date', 'customers_name'])"),
  metrics: z.array(z.string()).describe("Array of metric field IDs to include (e.g., ['orders_total_revenue', 'orders_count'])"),
  filters: z.any().optional().describe("Lightdash native filter object with dimensions/metrics filter groups. Each group has id and and/or array of filter rules with target.fieldId, operator, values."),
  sorts: z.array(z.object({
    fieldId: z.string(),
    descending: z.boolean(),
  })).optional().describe("Array of sort fields. Each has fieldId and descending boolean."),
  limit: z.number().optional().default(500).describe("Maximum number of rows to return (default 500, max 5000)"),
},
```

### Anti-Patterns to Avoid
- **Returning raw row objects:** Lightdash rows are `{ fieldName: { value: { raw, formatted } } }`. Extract raw values to flatten the response.
- **Returning SQL/compiledSql in explore schema:** Internal SQL is noise for the LLM. Filter to name, label, type, description only.
- **Not URL-encoding explore names:** Explore names can contain special characters. Use `encodeURIComponent(exploreName)` in URL paths.
- **Sending empty tableCalculations as undefined:** The runQuery endpoint requires `tableCalculations` to be an array. Default to `[]`.
- **Not handling the filter `id` field:** Every FilterGroup and FilterRule needs a unique `id`. Generate UUIDs or simple IDs if the LLM does not provide them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filter validation | Custom filter parser/validator | Passthrough native Lightdash format via `z.any()` | The API validates filters server-side; client validation would duplicate complex logic |
| Query timeout handling | Custom timeout/retry logic | `AbortSignal.timeout(60_000)` via client.post() | Already built into LightdashClient |
| Row format normalization | Custom row parser | Simple `value.raw` extraction loop | Lightdash row format is consistent |
| Deployment packaging | Webpack/esbuild bundling | `npm ci --omit=dev` + file copy | MCP stdio servers run from node, not browser; no bundling needed |
| UUID generation for filter IDs | uuid library | `crypto.randomUUID()` | Built into Node.js 22+ |

**Key insight:** The requirements explicitly say "native Lightdash filter/sort format." Do NOT create a simplified filter abstraction. Pass filters through to the API as-is. This avoids the leaky abstraction problem (noted in Out of Scope in REQUIREMENTS.md).

## Common Pitfalls

### Pitfall 1: Explore Name vs Explore ID Confusion
**What goes wrong:** The API path uses `exploreId` but the actual parameter is the explore `name` string (e.g., "orders"), not a UUID.
**Why it happens:** Lightdash names the path parameter `exploreId` in the OpenAPI spec, but explores are identified by name not UUID.
**How to avoid:** Use the explore `name` from `lightdash_list_explores` output as the `exploreId` path parameter. Document this clearly in tool descriptions.
**Warning signs:** 404 errors when using a UUID where a name is expected.

### Pitfall 2: Query Result Row Format
**What goes wrong:** Raw API response rows look like `{ "orders_total_revenue": { "value": { "raw": 1234.56, "formatted": "$1,234.56" } } }`. Passing this directly to the LLM wastes tokens on the nested structure.
**Why it happens:** Lightdash stores both raw and formatted values per cell.
**How to avoid:** Flatten rows to `{ "orders_total_revenue": 1234.56 }` by extracting `value.raw`. Include column names separately.
**Warning signs:** Extremely verbose JSON in tool responses. LLM confused by nested value objects.

### Pitfall 3: Large Explore Schemas
**What goes wrong:** Production explores can have hundreds of dimensions and metrics across multiple joined tables. The full explore response can be 50KB+.
**Why it happens:** Explores are compiled dbt models with every dimension and metric expanded.
**How to avoid:** Filter out hidden dimensions/metrics, omit SQL fields, keep only name/label/type/description. Consider that even filtered, large explores may hit context limits.
**Warning signs:** Tool response exceeding 10KB. LLM losing track of available fields.

### Pitfall 4: Missing tableCalculations in runQuery
**What goes wrong:** API returns 400 error because `tableCalculations` field is missing from request body.
**Why it happens:** `tableCalculations` is required in `MetricQueryRequest` but almost never used in ad-hoc queries.
**How to avoid:** Always default `tableCalculations` to `[]` in the tool handler.
**Warning signs:** 400 "tableCalculations is required" error from Lightdash API.

### Pitfall 5: Filter ID Requirements
**What goes wrong:** API may reject filters without `id` fields on FilterGroup and FilterRule objects.
**Why it happens:** Every filter group and rule needs a unique `id` for the UI to track them. The API may require this.
**How to avoid:** If the LLM sends filters without IDs, generate them in the tool handler using `crypto.randomUUID()`.
**Warning signs:** 400 errors mentioning missing `id` field in filters.

### Pitfall 6: Deploy Script Path Assumptions
**What goes wrong:** Deploy script fails because `~/lightdash-mcp/` uses tilde expansion, which does not work in all contexts.
**Why it happens:** Tilde expansion is a shell feature, not a Node.js or general OS feature.
**How to avoid:** Use `$HOME/lightdash-mcp` in the deploy script, not `~`. Resolve the path explicitly.
**Warning signs:** "No such file or directory" errors pointing to literal `~/lightdash-mcp`.

### Pitfall 7: Claude Desktop Config Env Var Quoting
**What goes wrong:** Environment variables in Claude Desktop config do not get expanded. Setting `LIGHTDASH_API_URL` to `$MY_URL` passes the literal string.
**Why it happens:** Claude Desktop reads the JSON file and passes env vars as-is. No shell expansion occurs.
**How to avoid:** Use literal values in the Claude Desktop config, not shell variable references. Document that users must set actual values.
**Warning signs:** Server fails to start with "LIGHTDASH_API_URL is not set" despite config file having entries.

## Code Examples

### Tool: lightdash_get_chart (DATA-01)
```typescript
// Source: Lightdash savedChartRouter.ts + packages/common/src/types/savedCharts.ts

export function registerGetChartTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_get_chart",
    {
      title: "Get Chart",
      description:
        "Get the full configuration of a saved chart including its query definition, chart type, and table name. Use the chartUuid from lightdash_search_charts.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        chartUuid: z.string().describe("UUID of the saved chart (from lightdash_search_charts)"),
      },
    },
    wrapToolHandler(async ({ chartUuid }: { chartUuid: string }) => {
      const chart = await client.get<SavedChartResponse>(
        `/saved/${chartUuid}`,
      );

      const filtered = {
        uuid: chart.uuid,
        name: chart.name,
        description: chart.description,
        tableName: chart.tableName,
        spaceName: chart.spaceName,
        chartType: chart.chartConfig?.type,
        metricQuery: {
          dimensions: chart.metricQuery.dimensions,
          metrics: chart.metricQuery.metrics,
          filters: chart.metricQuery.filters,
          sorts: chart.metricQuery.sorts,
          limit: chart.metricQuery.limit,
        },
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(filtered, null, 2) },
        ],
      };
    }),
  );
}
```

### Tool: lightdash_get_chart_results (DATA-02)
```typescript
// Source: Lightdash API docs -- POST /saved/{chartUuid}/results

export function registerGetChartResultsTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_get_chart_results",
    {
      title: "Get Chart Results",
      description:
        "Execute a saved chart and return the query results. Returns column names and data rows.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        chartUuid: z.string().describe("UUID of the saved chart (from lightdash_search_charts)"),
      },
    },
    wrapToolHandler(async ({ chartUuid }: { chartUuid: string }) => {
      const results = await client.post<ChartResultsResponse>(
        `/saved/${chartUuid}/results`,
        {},
        60_000, // 60s timeout for query execution
      );

      const MAX_ROWS = 500;
      const allRows = results.rows;
      const rows = allRows.slice(0, MAX_ROWS);

      // Flatten row values: extract raw values
      const simpleRows = rows.map((row: Record<string, any>) => {
        const simplified: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(row)) {
          simplified[key] = val?.value?.raw ?? val?.value ?? val;
        }
        return simplified;
      });

      const response: Record<string, unknown> = {
        columns: Object.keys(results.fields),
        rows: simpleRows,
        rowCount: allRows.length,
      };
      if (allRows.length > MAX_ROWS) {
        response.truncated = true;
        response.message = `Showing ${MAX_ROWS} of ${allRows.length} rows`;
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(response, null, 2) },
        ],
      };
    }),
  );
}
```

### Tool: lightdash_run_raw_query (DATA-04) -- Input Schema
```typescript
// Source: Lightdash packages/common/src/types/metricQuery.ts + filter.ts
inputSchema: {
  projectUuid: z.string().describe("UUID of the Lightdash project"),
  exploreName: z.string().describe("Name of the explore (from lightdash_list_explores)"),
  dimensions: z.array(z.string()).describe(
    "Array of dimension field IDs (e.g., ['orders_created_date', 'customers_name'])"
  ),
  metrics: z.array(z.string()).describe(
    "Array of metric field IDs (e.g., ['orders_total_revenue', 'orders_count'])"
  ),
  filters: z.any().optional().describe(
    "Native Lightdash filters object. Structure: { dimensions?: { id, and|or: [{ id, target: { fieldId }, operator, values?, settings? }] }, metrics?: { ... } }. Operators: equals, notEquals, contains, startsWith, greaterThan, lessThan, inThePast, inBetween, isNull, notNull, etc."
  ),
  sorts: z.array(
    z.object({
      fieldId: z.string(),
      descending: z.boolean(),
    })
  ).optional().describe("Sort order. Each item has fieldId and descending (true for DESC)."),
  limit: z.number().optional().default(500).describe("Max rows to return (default 500)"),
},
```

### Deploy Script (deploy.sh)
```bash
#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$HOME/lightdash-mcp"

echo "Building TypeScript..."
npm run build

echo "Installing production dependencies..."
npm ci --omit=dev

echo "Deploying to $DEPLOY_DIR..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r build "$DEPLOY_DIR/"
cp -r node_modules "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"

echo "Deployed to $DEPLOY_DIR"
echo ""
echo "Claude Desktop config (add to claude_desktop_config.json):"
echo '{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["'"$DEPLOY_DIR"'/build/index.js"],
      "env": {
        "LIGHTDASH_API_KEY": "your-api-key-here",
        "LIGHTDASH_API_URL": "https://your-lightdash-instance.com"
      }
    }
  }
}'
```

### Claude Desktop Configuration (BLDP-03)
```json
// File: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
// File: %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["/Users/username/lightdash-mcp/build/index.js"],
      "env": {
        "LIGHTDASH_API_KEY": "your-lightdash-personal-access-token",
        "LIGHTDASH_API_URL": "https://your-lightdash-instance.com"
      }
    }
  }
}
```

**Source:** MCP official documentation at https://modelcontextprotocol.io/docs/develop/connect-local-servers (HIGH confidence)

### TypeScript Interfaces for types.ts (Phase 3 additions)
```typescript
// --- SavedChart response from GET /saved/{chartUuid} ---

export interface SavedChartResponse {
  uuid: string;
  projectUuid: string;
  name: string;
  description?: string;
  tableName: string;
  metricQuery: {
    exploreName: string;
    dimensions: string[];
    metrics: string[];
    filters: Record<string, unknown>;
    sorts: Array<{ fieldId: string; descending: boolean }>;
    limit: number;
    tableCalculations: unknown[];
    additionalMetrics?: unknown[];
    customDimensions?: unknown[];
  };
  chartConfig: { type?: string; [key: string]: unknown };
  tableConfig: { columnOrder: string[] };
  pivotConfig?: { columns: string[] };
  updatedAt: string;
  spaceName: string;
  spaceUuid: string;
  slug: string;
  dashboardUuid: string | null;
  dashboardName: string | null;
  [key: string]: unknown;
}

// --- Chart/Query results from POST endpoints ---

export interface QueryResultsResponse {
  rows: Array<Record<string, { value: { raw: unknown; formatted: string } }>>;
  fields: Record<string, { fieldType: string; type: string; [key: string]: unknown }>;
  metricQuery: Record<string, unknown>;
  cacheMetadata: {
    cacheHit: boolean;
    cacheKey?: string;
    cacheExpiresAt?: string;
    cacheUpdatedTime?: string;
  };
}

// --- Explore schema from GET /projects/{uuid}/explores/{name} ---

export interface ExploreResponse {
  name: string;
  label: string;
  baseTable: string;
  tags: string[];
  targetDatabase: string;
  type?: string;
  groupLabel?: string;
  tables: Record<string, CompiledTableResponse>;
  joinedTables: Array<{
    table: string;
    sqlOn: string;
    compiledSqlOn: string;
    type?: string;
    hidden?: boolean;
    always?: boolean;
    relationship?: string;
  }>;
  [key: string]: unknown;
}

export interface CompiledTableResponse {
  name: string;
  label: string;
  description?: string;
  dimensions: Record<string, CompiledFieldResponse>;
  metrics: Record<string, CompiledFieldResponse>;
  [key: string]: unknown;
}

export interface CompiledFieldResponse {
  name: string;
  label: string;
  table: string;
  type: string;
  description?: string;
  hidden?: boolean;
  fieldType: string;
  [key: string]: unknown;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `POST /saved/{chartUuid}/results` (v1 sync) | `POST /api/v2/saved/{chartUuid}/results-async` (v2 async) | Recent Lightdash versions | v1 still works; v2 is async with polling. Use v1 for MCP (simpler). |
| `server.tool()` | `server.registerTool()` | MCP SDK v1.x | Use `registerTool` (already established in Phase 1+2) |
| Custom filter abstractions | Native Lightdash filter passthrough | Project decision (REQUIREMENTS.md) | Avoids leaky abstraction; documented as Out of Scope |

**Deprecated/outdated:**
- `POST /saved/{chartUuid}/results` is marked deprecated in API docs but still functional. Monitor for removal.
- `POST /saved/{chartUuid}/chart-and-results` is also deprecated. Do not use; `GET /saved/{chartUuid}` + `POST /saved/{chartUuid}/results` gives the same data separately.

## Open Questions

1. **Row value format consistency**
   - What we know: Lightdash docs show rows as `Record<string, { value: { raw, formatted } }>`. Some rows may have different shapes depending on field types.
   - What's unclear: Whether all field types (dates, booleans, arrays) follow the same `{ raw, formatted }` pattern, or if some return just a primitive.
   - Recommendation: Use defensive access: `val?.value?.raw ?? val?.value ?? val`. Test with actual chart execution at implementation time.

2. **Explore name URL encoding**
   - What we know: Explore names are typically lowercase snake_case (e.g., "orders", "customers"). But they could contain spaces or special characters.
   - What's unclear: Whether any real-world explore names contain characters that need URL encoding.
   - Recommendation: Always use `encodeURIComponent(exploreName)` in the URL path. Zero cost if not needed, prevents bugs if needed.

3. **runQuery requires exploreName in both URL and body**
   - What we know: The API path includes `exploreId` and the body requires `exploreName`. Both must match.
   - What's unclear: Whether the API validates they match or prefers one over the other.
   - Recommendation: Set both to the same value. The tool handler should copy the `exploreName` parameter to both locations.

4. **Deploy script: npm ci vs npm install for production**
   - What we know: `npm ci --omit=dev` installs only production dependencies from lockfile. But the source project's node_modules also has devDependencies.
   - What's unclear: Whether `npm ci --omit=dev` should be run in the deploy directory or the source directory.
   - Recommendation: Run `npm ci --omit=dev` in a clean copy, or simply copy `node_modules` after running `npm ci --omit=dev` in the source directory. Simplest approach: run in source, then copy both `build/` and `node_modules/` to deploy target.

## Sources

### Primary (HIGH confidence)
- [Lightdash savedChartRouter.ts](https://github.com/lightdash/lightdash/blob/main/packages/backend/src/routers/savedChartRouter.ts) -- Confirmed `GET /:savedQueryUuidOrSlug` route exists, returns SavedChart
- [Lightdash savedCharts.ts types](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/savedCharts.ts) -- SavedChart interface with all fields
- [Lightdash filter.ts types](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/filter.ts) -- FilterOperator, FilterRule, FilterGroup, Filters types
- [Lightdash metricQuery.ts types](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/metricQuery.ts) -- MetricQuery, MetricQueryRequest, SortField types
- [Lightdash explore.ts types](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/explore.ts) -- Explore, CompiledTable, CompiledExploreJoin
- [Lightdash field.ts types](https://github.com/lightdash/lightdash/blob/main/packages/common/src/types/field.ts) -- DimensionType, MetricType, Dimension, Metric
- [Lightdash API docs -- Run chart query](https://docs.lightdash.com/api-reference/charts/run-chart-query) -- POST /saved/{chartUuid}/results endpoint schema
- [Lightdash API docs -- Get explore](https://docs.lightdash.com/api-reference/projects/get-explore) -- GET /projects/{uuid}/explores/{exploreId} response schema
- [Lightdash API docs -- Run metric query](https://docs.lightdash.com/api-reference/exploring/run-metric-query) -- POST /projects/{uuid}/explores/{exploreId}/runQuery endpoint schema
- [MCP official docs -- Connect local servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) -- Claude Desktop config format

### Secondary (MEDIUM confidence)
- [Lightdash API docs -- Get chart and results](https://docs.lightdash.com/api-reference/charts/get-chart-and-results) -- POST /saved/{chartUuid}/chart-and-results (deprecated, but confirms response shape)
- [Lightdash API docs -- Get chart version](https://docs.lightdash.com/api-reference/charts/get-chart-version) -- GET /saved/{chartUuid}/version/{versionUuid} (confirms SavedChart fields in chart property)

### Tertiary (LOW confidence)
- Row value format for all field types -- needs runtime verification
- Whether API validates exploreName match between URL path and request body -- needs testing

## Metadata

**Confidence breakdown:**
- API endpoints (paths, methods): HIGH -- confirmed from Lightdash source code routes and API docs
- Request/response schemas: HIGH -- extracted from Lightdash TypeScript source types and API documentation
- Filter/sort format: HIGH -- directly from Lightdash filter.ts and metricQuery.ts source
- Tool registration pattern: HIGH -- identical to 6 working tools from Phase 1+2
- Deploy script pattern: HIGH -- standard npm + file copy, Claude Desktop config from official MCP docs
- Row value format details: MEDIUM -- confirmed structure from API docs, edge cases need runtime testing

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days -- Lightdash API v1 is stable, MCP SDK v1.x is stable)
