/**
 * Chart tools: lightdash_search_charts (DISC-03), lightdash_get_chart (DATA-01)
 *
 * lightdash_search_charts: Searches saved charts in a Lightdash project by name.
 * lightdash_get_chart: Retrieves full configuration of a saved chart.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { LightdashChartSummary, SavedChartResponse } from "../types.js";

/**
 * Register the lightdash_search_charts tool on the MCP server.
 * Accepts a projectUuid and query string, returns filtered chart matches.
 */
export function registerSearchChartsTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_search_charts",
    {
      title: "Search Charts",
      description:
        "Search saved charts in a Lightdash project by name. Returns matching chart summaries with UUIDs and types.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      inputSchema: {
        projectUuid: z
          .string()
          .describe("UUID of the Lightdash project"),
        query: z
          .string()
          .describe("Search term to filter chart names (case-insensitive)"),
      },
    },
    wrapToolHandler(
      async ({ projectUuid, query }: { projectUuid: string; query: string }) => {
        const allCharts = await client.get<LightdashChartSummary[]>(
          `/projects/${projectUuid}/charts`,
        );

        // Server-side case-insensitive filtering
        const lowerQuery = query.toLowerCase();
        const matches = allCharts.filter((c) =>
          c.name.toLowerCase().includes(lowerQuery),
        );

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No charts found matching "${query}" in project ${projectUuid}. Try a broader search term or use lightdash_list_spaces to browse by space.`,
              },
            ],
          };
        }

        // Field filtering: return only essential fields
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
      },
    ),
  );
}

/**
 * Register the lightdash_get_chart tool on the MCP server.
 * Retrieves the full configuration of a saved chart by UUID.
 */
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      inputSchema: {
        chartUuid: z
          .string()
          .describe("UUID of the saved chart (from lightdash_search_charts)"),
      },
    },
    wrapToolHandler(
      async ({ chartUuid }: { chartUuid: string }) => {
        const chart = await client.get<SavedChartResponse>(
          `/saved/${chartUuid}`,
        );

        // Filter to essential fields only
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
            {
              type: "text" as const,
              text: JSON.stringify(filtered, null, 2),
            },
          ],
        };
      },
    ),
  );
}
