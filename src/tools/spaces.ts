/**
 * Discovery tool: lightdash_list_spaces (DISC-02)
 *
 * Lists all spaces in a Lightdash project.
 * Field filtering: returns only uuid, name, isPrivate, chartCount,
 * dashboardCount, parentSpaceUuid per space.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { LightdashSpaceSummary } from "../types.js";

/**
 * Register the lightdash_list_spaces tool on the MCP server.
 * Accepts a projectUuid and returns filtered space list.
 */
export function registerListSpacesTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_list_spaces",
    {
      title: "List Spaces",
      description:
        "List all spaces in a Lightdash project. Returns space names, UUIDs, privacy status, and content counts.",
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
      const spaces = await client.get<LightdashSpaceSummary[]>(
        `/projects/${projectUuid}/spaces`,
      );

      if (spaces.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No spaces found in project ${projectUuid}.`,
            },
          ],
        };
      }

      // Field filtering: return only essential fields
      const filtered = spaces.map((s) => ({
        uuid: s.uuid,
        name: s.name,
        isPrivate: s.isPrivate,
        chartCount: s.chartCount,
        dashboardCount: s.dashboardCount,
        parentSpaceUuid: s.parentSpaceUuid,
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
