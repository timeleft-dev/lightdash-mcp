/**
 * Smoke-test tool: lightdash_ping
 *
 * Validates the entire MCP + Lightdash API stack end-to-end:
 * - INFRA-01: Stdout purity (no non-JSON-RPC output)
 * - INFRA-03/04/05: Client URL normalization, auth header, envelope unwrapping
 * - INFRA-06: Server-side field filtering (org response -> 3 fields)
 * - INFRA-07/09: Error handling via wrapToolHandler with sanitized messages
 * - INFRA-08: Client timeout
 * - INFRA-10: lightdash_ tool prefix
 * - INFRA-11: readOnlyHint annotation
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LightdashClient } from "../client.js";
import { wrapToolHandler } from "../errors.js";

/**
 * Org info response from GET /org.
 * We only expose a filtered subset to the LLM (INFRA-06).
 */
interface OrgResponse {
  organizationUuid: string;
  organizationName: string;
  needsProject: boolean;
  [key: string]: unknown;
}

/**
 * Register the lightdash_ping tool on the MCP server.
 * Tests connectivity to the Lightdash instance and returns filtered org info.
 */
export function registerPingTool(
  server: McpServer,
  client: LightdashClient,
): void {
  server.registerTool(
    "lightdash_ping",
    {
      title: "Ping Lightdash",
      description:
        "Test connectivity to the Lightdash instance. Returns server status and basic org info.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    wrapToolHandler(async () => {
      const org = await client.get<OrgResponse>("/org");

      // Field filtering (INFRA-06): return only essential fields
      const filtered = {
        organizationName: org.organizationName,
        organizationUuid: org.organizationUuid,
        needsProject: org.needsProject,
      };

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
