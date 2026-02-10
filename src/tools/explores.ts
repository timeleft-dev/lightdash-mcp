/**
 * Discovery tool: lightdash_list_explores (DISC-05)
 *
 * Lists all explores (data models) in a Lightdash project.
 * Handles the explore union type: explores can be in error state.
 * Returns name, label, description, tags, and status with error messages.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { LightdashExploreSummary } from "../types.js";

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
