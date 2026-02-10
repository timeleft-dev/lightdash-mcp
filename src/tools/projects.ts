/**
 * Discovery tool: lightdash_list_projects (DISC-01)
 *
 * Lists all projects in the organization.
 * Field filtering: returns only uuid, name, type per project.
 *
 * Note: warehouseType is not on the ProjectSummary list endpoint;
 * type (DEFAULT/PREVIEW) is provided instead.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";
import type { OrgProjectResponse } from "../types.js";

/**
 * Register the lightdash_list_projects tool on the MCP server.
 * Returns filtered project list with uuid, name, and type.
 */
export function registerListProjectsTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_list_projects",
    {
      title: "List Projects",
      description:
        "List all Lightdash projects in the organization. Returns project names, UUIDs, and types.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    wrapToolHandler(async () => {
      const projects =
        await client.get<OrgProjectResponse[]>("/org/projects");

      if (projects.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No projects found in this organization.",
            },
          ],
        };
      }

      // Field filtering: return only essential fields
      const filtered = projects.map((p) => ({
        uuid: p.projectUuid,
        name: p.name,
        type: p.type,
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
