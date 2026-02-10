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
