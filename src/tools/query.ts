/**
 * Data access tool: lightdash_run_raw_query (DATA-04)
 *
 * Executes an ad-hoc metric query against a Lightdash explore.
 * Accepts dimensions, metrics, optional filters (native Lightdash format),
 * sorts, and row limit. Returns flattened rows truncated to 500.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { QueryResultsResponse } from "../types.js";

/**
 * Register the lightdash_run_raw_query tool on the MCP server.
 * Executes ad-hoc queries with native Lightdash filter passthrough and row flattening.
 */
export function registerRunRawQueryTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_run_raw_query",
    {
      title: "Run Raw Query",
      description:
        "Execute an ad-hoc metric query against a Lightdash explore. Specify dimensions, metrics, and optionally filters (native Lightdash format), sorts, and row limit. Use lightdash_get_explore first to discover available fields.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      inputSchema: {
        projectUuid: z
          .string()
          .describe("UUID of the Lightdash project"),
        exploreName: z
          .string()
          .describe("Name of the explore (from lightdash_list_explores)"),
        dimensions: z
          .array(z.string())
          .describe(
            "Array of dimension field IDs (e.g., ['orders_created_date', 'customers_name'])",
          ),
        metrics: z
          .array(z.string())
          .describe(
            "Array of metric field IDs (e.g., ['orders_total_revenue', 'orders_count'])",
          ),
        filters: z
          .any()
          .optional()
          .describe(
            "Native Lightdash filters object. Structure: { dimensions?: { id, and|or: [{ id, target: { fieldId }, operator, values?, settings? }] }, metrics?: { ... } }. Operators: equals, notEquals, contains, startsWith, greaterThan, lessThan, inThePast, inBetween, isNull, notNull, etc.",
          ),
        sorts: z
          .array(
            z.object({
              fieldId: z.string(),
              descending: z.boolean(),
            }),
          )
          .optional()
          .describe(
            "Sort order. Each item has fieldId and descending (true for DESC).",
          ),
        limit: z
          .number()
          .optional()
          .default(500)
          .describe("Max rows to return (default 500, max 5000)"),
      },
    },
    wrapToolHandler(
      async ({
        projectUuid,
        exploreName,
        dimensions,
        metrics,
        filters,
        sorts,
        limit,
      }: {
        projectUuid: string;
        exploreName: string;
        dimensions: string[];
        metrics: string[];
        filters?: unknown;
        sorts?: Array<{ fieldId: string; descending: boolean }>;
        limit: number;
      }) => {
        const clampedLimit = Math.min(limit, 5000);

        const body = {
          exploreName,
          dimensions,
          metrics,
          filters: filters ?? {},
          sorts: sorts ?? [],
          limit: clampedLimit,
          tableCalculations: [],
        };

        const results = await client.post<QueryResultsResponse>(
          `/projects/${projectUuid}/explores/${encodeURIComponent(exploreName)}/runQuery`,
          body,
          60_000,
        );

        const MAX_ROWS = 500;
        const allRows = results.rows;
        const rows = allRows.slice(0, MAX_ROWS);

        // Flatten rows: extract raw values from nested {value:{raw,formatted}} structure
        const simpleRows = rows.map((row) => {
          const flat: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(row)) {
            flat[key] = val?.value?.raw ?? val?.value ?? val;
          }
          return flat;
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
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      },
    ),
  );
}
