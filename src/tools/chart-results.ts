/**
 * Discovery tool: lightdash_get_chart_results (DATA-02)
 *
 * Executes a saved chart and returns flattened query result rows.
 * Row values are flattened from nested {value:{raw,formatted}} to simple raw values.
 * Results are truncated to 500 rows with a truncation message when exceeding the limit.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { QueryResultsResponse } from "../types.js";

/**
 * Register the lightdash_get_chart_results tool on the MCP server.
 * Executes a saved chart and returns flattened result rows.
 */
export function registerGetChartResultsTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_get_chart_results",
    {
      title: "Get Chart Results",
      description:
        "Execute a saved chart and return the query results as data rows. Returns column names and flattened row values.",
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
        const results = await client.post<QueryResultsResponse>(
          `/saved/${chartUuid}/results`,
          {},
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
