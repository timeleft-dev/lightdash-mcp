/**
 * Shared TypeScript interfaces for Lightdash API responses.
 *
 * This file will grow as tools are added in Phase 2+.
 * Each tool's response types will be defined here for consistent typing.
 */

/**
 * Standard Lightdash API response envelope.
 * All Lightdash API endpoints return { status: string, results: T }.
 */
export interface LightdashApiResponse<T> {
  status: string;
  results: T;
}

/**
 * Lightdash project summary returned by /api/v1/org/projects.
 */
export interface LightdashProject {
  projectUuid: string;
  name: string;
  warehouseType: string;
}

// ── Phase 2: Discovery tool response types ──────────────────────────

/** Raw project from GET /org/projects. Index signature for unknown extra fields. */
export interface OrgProjectResponse {
  projectUuid: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

/** Space summary from GET /projects/{uuid}/spaces */
export interface LightdashSpaceSummary {
  uuid: string;
  name: string;
  isPrivate: boolean;
  chartCount: number;
  dashboardCount: number;
  parentSpaceUuid: string | null;
  [key: string]: unknown;
}

/** Chart entry from GET /projects/{uuid}/charts (SpaceQuery type in Lightdash) */
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

/** Dashboard entry from GET /projects/{uuid}/dashboards */
export interface LightdashDashboardSummary {
  uuid: string;
  name: string;
  description?: string;
  spaceUuid: string;
  updatedAt: string;
  [key: string]: unknown;
}

/** Explore summary from GET /projects/{uuid}/explores (union type: ok or error) */
export interface LightdashExploreSummary {
  name: string;
  label: string;
  description?: string;
  tags: string[];
  errors?: Array<{ type: string; message: string }>;
  [key: string]: unknown;
}

// ── Phase 3: Data access tool response types ─────────────────────────

/** Full saved chart from GET /saved/{chartUuid} (DATA-01) */
export interface SavedChartResponse {
  uuid: string;
  projectUuid: string;
  name: string;
  description: string | undefined;
  tableName: string;
  metricQuery: {
    exploreName: string;
    dimensions: string[];
    metrics: string[];
    filters: Record<string, unknown>;
    sorts: Array<{ fieldId: string; descending: boolean }>;
    limit: number;
    tableCalculations: unknown[];
    additionalMetrics: unknown[] | undefined;
    customDimensions: unknown[] | undefined;
  };
  chartConfig: { type?: string; [key: string]: unknown };
  tableConfig: { columnOrder: string[] };
  pivotConfig: { columns: string[] } | undefined;
  updatedAt: string;
  spaceName: string;
  spaceUuid: string;
  slug: string;
  dashboardUuid: string | null;
  dashboardName: string | null;
  [key: string]: unknown;
}

/** Query results from POST /saved/{chartUuid}/results or POST runQuery (DATA-02) */
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

/** Full explore definition from GET /projects/{uuid}/explores/{name} (DATA-03) */
export interface ExploreResponse {
  name: string;
  label: string;
  baseTable: string;
  tags: string[];
  targetDatabase: string;
  type: string | undefined;
  groupLabel: string | undefined;
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

/** Compiled table within an explore */
export interface CompiledTableResponse {
  name: string;
  label: string;
  description: string | undefined;
  dimensions: Record<string, CompiledFieldResponse>;
  metrics: Record<string, CompiledFieldResponse>;
  [key: string]: unknown;
}

/** Compiled field (dimension or metric) within a table */
export interface CompiledFieldResponse {
  name: string;
  label: string;
  table: string;
  type: string;
  description: string | undefined;
  hidden: boolean | undefined;
  fieldType: string;
  [key: string]: unknown;
}
