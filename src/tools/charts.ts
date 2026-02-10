/**
 * Discovery tool: lightdash_search_charts (DISC-03)
 *
 * Searches saved charts in a Lightdash project by name.
 * Server-side case-insensitive filtering compresses 413KB+ payloads
 * down to compact filtered results with only essential fields.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { LightdashChartSummary } from "../types.js";

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
