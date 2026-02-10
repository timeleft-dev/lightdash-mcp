#!/usr/bin/env node

// Stdout guard -- MUST be the FIRST executable line (INFRA-01).
// Redirect console.log to stderr BEFORE any other imports, which may
// call console.log during module initialization and corrupt the
// JSON-RPC stream on stdout.
console.log = (...args: unknown[]) => {
  console.error("[redirected]", ...args);
};

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LightdashClient } from "./client.js";
import { log } from "./logger.js";
import { registerPingTool } from "./tools/ping.js";
import { registerListProjectsTool } from "./tools/projects.js";
import { registerListSpacesTool } from "./tools/spaces.js";
import { registerSearchChartsTool, registerGetChartTool } from "./tools/charts.js";
import { registerGetChartResultsTool } from "./tools/chart-results.js";
import { registerListDashboardsTool } from "./tools/dashboards.js";
import { registerListExploresTool, registerGetExploreTool } from "./tools/explores.js";
import { registerRunRawQueryTool } from "./tools/query.js";

// Environment validation -- fail fast with clear guidance (INFRA-02)
const apiKey = process.env.LIGHTDASH_API_KEY;
const apiUrl = process.env.LIGHTDASH_API_URL;

if (!apiKey || !apiUrl) {
  if (!apiKey) {
    log.error("FATAL: LIGHTDASH_API_KEY is not set");
  }
  if (!apiUrl) {
    log.error("FATAL: LIGHTDASH_API_URL is not set");
  }
  log.error(
    "Set these in Claude Desktop config under mcpServers.lightdash.env",
  );
  process.exit(1);
}

// Create MCP server
const server = new McpServer({ name: "lightdash", version: "1.0.0" });

// Create Lightdash API client
const client = new LightdashClient({ baseUrl: apiUrl, apiKey });

// Register tools
registerPingTool(server, client);
registerListProjectsTool(server, client);
registerListSpacesTool(server, client);
registerSearchChartsTool(server, client);
registerListDashboardsTool(server, client);
registerListExploresTool(server, client);
registerGetChartTool(server, client);
registerGetChartResultsTool(server, client);
registerGetExploreTool(server, client);
registerRunRawQueryTool(server, client);

// Start server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("Lightdash MCP server started on stdio transport");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
