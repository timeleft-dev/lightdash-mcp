/**
 * Discovery tool: lightdash_list_dashboards (DISC-04)
 *
 * Lists dashboards in a Lightdash project with optional name filter.
 * Returns dashboard summaries with only essential fields.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { LightdashDashboardSummary } from "../types.js";

/**
 * Register the lightdash_list_dashboards tool on the MCP server.
 * Accepts a projectUuid and optional query string, returns filtered dashboard list.
 */
export function registerListDashboardsTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_list_dashboards",
    {
      title: "List Dashboards",
      description:
        "List dashboards in a Lightdash project with optional name filter. Returns dashboard summaries.",
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
          .optional()
          .describe(
            "Optional search term to filter dashboard names (case-insensitive)",
          ),
      },
    },
    wrapToolHandler(
      async ({
        projectUuid,
        query,
      }: {
        projectUuid: string;
        query?: string;
      }) => {
        const dashboards = await client.get<LightdashDashboardSummary[]>(
          `/projects/${projectUuid}/dashboards`,
        );

        // Optional case-insensitive filtering
        let results = dashboards;
        if (query) {
          const lowerQuery = query.toLowerCase();
          results = dashboards.filter((d) =>
            d.name.toLowerCase().includes(lowerQuery),
          );
        }

        if (results.length === 0) {
          const msg = query
            ? `No dashboards found matching "${query}" in project ${projectUuid}.`
            : `No dashboards found in project ${projectUuid}.`;
          return {
            content: [
              {
                type: "text" as const,
                text: msg,
              },
            ],
          };
        }

        // Field filtering: return only essential fields
        const filtered = results.map((d) => ({
          uuid: d.uuid,
          name: d.name,
          description: d.description,
          spaceUuid: d.spaceUuid,
          updatedAt: d.updatedAt,
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
