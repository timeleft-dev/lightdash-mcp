/**
 * Explore tools: lightdash_list_explores (DISC-05), lightdash_get_explore (DATA-03)
 *
 * lightdash_list_explores: Lists all explores (data models) in a Lightdash project.
 * lightdash_get_explore: Gets the full schema of an explore with visible fields only.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type {
  LightdashExploreSummary,
  ExploreResponse,
  CompiledTableResponse,
  CompiledFieldResponse,
} from "../types.js";

/**
 * Register the lightdash_list_explores tool on the MCP server.
 * Accepts a projectUuid and returns filtered explore list with error status.
 */
export function registerListExploresTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_list_explores",
    {
      title: "List Explores",
      description:
        "List all explores (data models) in a Lightdash project. Returns explore names, labels, descriptions, tags, and error status.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
      inputSchema: {
        projectUuid: z
          .string()
          .describe("UUID of the Lightdash project"),
      },
    },
    wrapToolHandler(async ({ projectUuid }: { projectUuid: string }) => {
      const explores = await client.get<LightdashExploreSummary[]>(
        `/projects/${projectUuid}/explores`,
      );

      if (explores.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No explores found in project ${projectUuid}.`,
            },
          ],
        };
      }

      // Field filtering with error state handling
      const filtered = explores.map((e) => ({
        name: e.name,
        label: e.label,
        description: e.description,
        tags: e.tags,
        ...(e.errors && e.errors.length > 0
          ? { status: "error" as const, errors: e.errors.map((err) => err.message) }
          : { status: "ok" as const }),
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

/**
 * Register the lightdash_get_explore tool on the MCP server.
 * Returns the full schema of an explore with only visible fields (hidden filtered out, SQL omitted).
 */
export function registerGetExploreTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_get_explore",
    {
      title: "Get Explore",
      description:
        "Get the full schema of a Lightdash explore including all tables, dimensions, metrics, and joins. Use the explore name from lightdash_list_explores. Returns only visible fields with name, label, type, and description (SQL internals omitted).",
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
      },
    },
    wrapToolHandler(
      async ({
        projectUuid,
        exploreName,
      }: {
        projectUuid: string;
        exploreName: string;
      }) => {
        const explore = await client.get<ExploreResponse>(
          `/projects/${projectUuid}/explores/${encodeURIComponent(exploreName)}`,
        );

        // Filter tables: only visible dimensions and metrics, omit SQL fields
        const tables = Object.values(explore.tables).map(
          (table: CompiledTableResponse) => ({
            name: table.name,
            label: table.label,
            description: table.description,
            dimensions: Object.values(table.dimensions)
              .filter((d: CompiledFieldResponse) => !d.hidden)
              .map((d: CompiledFieldResponse) => ({
                name: d.name,
                label: d.label,
                type: d.type,
                description: d.description,
              })),
            metrics: Object.values(table.metrics)
              .filter((m: CompiledFieldResponse) => !m.hidden)
              .map((m: CompiledFieldResponse) => ({
                name: m.name,
                label: m.label,
                type: m.type,
                description: m.description,
              })),
          }),
        );

        // Filter joins: omit hidden joins and SQL fields
        const joins = explore.joinedTables
          .filter((j) => !j.hidden)
          .map((j) => ({
            table: j.table,
            type: j.type,
            relationship: j.relationship,
          }));

        const filtered = {
          name: explore.name,
          label: explore.label,
          baseTable: explore.baseTable,
          tags: explore.tags,
          tables,
          joins,
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
