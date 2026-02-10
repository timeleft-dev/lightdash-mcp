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
