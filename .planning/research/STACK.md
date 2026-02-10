# Stack Research

**Domain:** Custom MCP server wrapping Lightdash REST API (TypeScript, stdio transport)
**Researched:** 2026-02-10
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS | Runtime | Node 22 is in Maintenance LTS (supported until April 2027). Node 24 LTS is the newest Active LTS, but Node 22 is safer for tool compatibility. Claude Desktop spawns the server as a subprocess, so we want maximum stability, not bleeding-edge. |
| TypeScript | 5.9.x | Language | Current stable release. Provides strict type safety for MCP SDK types, zod schemas, and Lightdash API response shaping. TypeScript 7 (Go-based native compiler) is in preview but not production-ready. |
| @modelcontextprotocol/sdk | 1.26.x | MCP protocol framework | The official TypeScript SDK. v1.x is the production-recommended version (v2 is pre-alpha, targeting Q1 2026 stable). Provides `McpServer` class and `StdioServerTransport` out of the box. 24,000+ npm dependents -- this is the standard. |
| zod | 3.25.x | Schema validation | Required peer dependency of @modelcontextprotocol/sdk. The SDK internally imports from `zod/v4` but maintains backwards compatibility with zod >=3.25. Use `zod@3` (not zod@4) to match the official quickstart and avoid edge-case compatibility issues with the v1 SDK. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-in `fetch` | (built-in) | HTTP client for Lightdash API | Always. Node 22 has stable, spec-compliant `fetch`. No need for axios or node-fetch. Fewer dependencies = fewer things to break. |
| Node.js built-in `process.env` | (built-in) | Environment variable config | Always. For `LIGHTDASH_API_KEY` and `LIGHTDASH_API_URL`. No dotenv needed -- Claude Desktop passes env vars via config. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsc` (TypeScript compiler) | Compile TS to JS | Compile `src/` to `build/` (or `dist/`). Use `"module": "Node16"`, `"target": "ES2022"`. |
| `@modelcontextprotocol/inspector` | Test/debug MCP server | Run with `npx @modelcontextprotocol/inspector node build/index.js`. Opens browser UI at localhost:6274 for interactive tool testing. |
| `@types/node` | Node.js type definitions | Dev dependency. Match to Node.js major version (22.x). |

## Project Configuration

### package.json

```json
{
  "name": "lightdash-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "lightdash-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js",
    "inspect": "npx @modelcontextprotocol/inspector node build/index.js"
  },
  "files": ["build"]
}
```

**Confidence: HIGH** -- Matches official MCP quickstart from modelcontextprotocol.io exactly.

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Confidence: HIGH** -- This is the exact tsconfig from the official MCP "Build a Server" tutorial.

### Key Configuration Notes

- **`"type": "module"`** in package.json is mandatory. The MCP SDK is ESM-only.
- **`"module": "Node16"`** (not `"NodeNext"`) for stability. Both work, but Node16 is what the official docs use.
- **Import paths must include `.js` extension** in TypeScript source files (e.g., `import { foo } from "./utils.js"`). This is an ESM requirement -- the compiler outputs `.js` files and imports must match the output, not the source.
- **shebang** `#!/usr/bin/env node` at top of `src/index.ts` if using the `bin` field in package.json.

## Import Patterns

```typescript
// MCP SDK -- v1.x import paths
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
```

**Confidence: HIGH** -- Verified against official MCP "Build a Server" tutorial at modelcontextprotocol.io and v1 SDK documentation.

### Server Bootstrap Pattern

```typescript
const server = new McpServer({
  name: "lightdash",
  version: "1.0.0",
});

// Register tools here...

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lightdash MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

### Tool Registration Pattern

```typescript
server.registerTool(
  "list_projects",
  {
    description: "List all projects in the Lightdash organization",
    inputSchema: {},
  },
  async () => {
    // Make HTTP call to Lightdash API
    // Unwrap { results: ... } wrapper
    // Filter to only needed fields
    return {
      content: [{ type: "text", text: JSON.stringify(filtered) }],
    };
  },
);
```

### HTTP Client Pattern (Lightdash API)

```typescript
async function lightdashApi<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = process.env.LIGHTDASH_API_URL!;
  const apiKey = process.env.LIGHTDASH_API_KEY!;
  const url = `${baseUrl}/api/v1${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Lightdash API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { results: T };
  return data.results;  // Unwrap the { results: ... } wrapper
}
```

**Confidence: HIGH** -- Auth header format (`ApiKey <token>`) and response wrapper confirmed from project requirements. Built-in fetch verified stable in Node 22.

## Installation

```bash
# Core
npm install @modelcontextprotocol/sdk zod@3

# Dev dependencies
npm install -D @types/node typescript
```

**That is the entire dependency list.** Four packages total (2 runtime, 2 dev). This is intentional -- an MCP server wrapping a REST API should be minimal.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@modelcontextprotocol/sdk` v1.x | FastMCP (`fastmcp` npm) | FastMCP adds convenience but is an abstraction over the SDK. For a focused, 10-tool server with stdio transport, the official SDK is simpler and has zero risk of framework-specific bugs. FastMCP is better for HTTP-deployed servers with auth/sessions. |
| `@modelcontextprotocol/sdk` v1.x | `@modelcontextprotocol/sdk` v2 (pre-alpha) | v2 restructures into `@modelcontextprotocol/server` and `@modelcontextprotocol/client` packages in a monorepo. It is pre-alpha as of Feb 2026 -- "v1.x remains the recommended version for production use." Do not use v2 yet. |
| Built-in `fetch` | `axios` | axios adds 400KB+ of dependencies for zero benefit. Node 22 `fetch` is stable and spec-compliant. For a server that makes simple GET/POST calls with headers, built-in fetch is ideal. |
| Built-in `fetch` | `node-fetch` | node-fetch was the polyfill for Node <18. Node 22 has native fetch. node-fetch is now unnecessary overhead. |
| Built-in `process.env` | `dotenv` | Claude Desktop passes env vars directly in the `mcpServers` config (`"env": {...}`). No `.env` file is needed. Adding dotenv adds complexity for a non-existent use case. |
| `zod@3` (3.25+) | `zod@4` (4.3.x) | The SDK docs and quickstart install `zod@3`. The SDK internally uses `zod/v4` imports but has backwards compat with zod >=3.25. Using zod@3 avoids any edge-case issues with the v1 SDK while still getting the validation the SDK needs. |
| TypeScript 5.9 | TypeScript 7 (native preview) | TS 7 is the Go-based rewrite for performance. It is in preview and not stable. TS 5.9 is the current production release. |
| Node.js 22 LTS | Node.js 24 LTS | Node 24 is Active LTS but newer. Node 22 is Maintenance LTS (until April 2027) and is the safer bet for tool ecosystem compatibility. Either works; 22 is the conservative choice. |
| Node.js 22 LTS | Node.js 20 LTS | Node 20 works but enters EOL April 2026 (2 months away). No reason to start a new project on it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `console.log()` anywhere | Writes to stdout, which is the JSON-RPC transport channel. Any stdout pollution breaks the MCP protocol. This is the #1 cause of broken MCP servers. | `console.error()` for all logging (writes to stderr). |
| `lightdash-mcp-server` npm package | The existing npm package has two critical bugs: stdout pollution from console.log, and returning raw unfiltered API payloads (413K+) that blow Claude's context window. This project exists to replace it. | Build from scratch with @modelcontextprotocol/sdk. |
| Express / Hono / any HTTP framework | This is a stdio server. HTTP frameworks are for Streamable HTTP transport. Adding one adds complexity and dependencies for zero benefit. | Direct `StdioServerTransport` from the SDK. |
| `ts-node` / `tsx` for production | These are dev-time conveniences that add startup overhead and potential issues. Claude Desktop should run compiled JS, not transpile-on-the-fly. | Compile with `tsc`, run `node build/index.js`. |
| Any stdout-logging library (winston, pino defaults) | Most logging libraries default to stdout. If you add one, you MUST configure it to write to stderr or a file. | `console.error()` is sufficient for a CLI tool. If you want structured logging, configure the library for stderr only. |
| `dotenv` | Claude Desktop config provides env vars directly. Adding dotenv creates a false dependency and a potential source of confusion (which .env file? which directory?). | Use `process.env` directly. Document required env vars in README. |
| OpenAPI code generation | Tempting for API wrappers, but our server only needs ~10 endpoints with heavy response filtering. Code generation would produce a full client for all endpoints, and we would still need to manually filter every response. More code, more maintenance, no benefit. | Hand-written `lightdashApi()` helper function with typed responses. |

## Stack Patterns by Variant

**If deploying only via Claude Desktop (stdio):**
- Use the exact stack above. No modifications needed.
- Claude Desktop config: `{ "command": "node", "args": ["/Users/mikhailgasanov/lightdash-mcp/build/index.js"], "env": { "LIGHTDASH_API_KEY": "...", "LIGHTDASH_API_URL": "..." } }`

**If later adding HTTP transport (for remote access):**
- Would need to add Streamable HTTP transport from the SDK
- Would require an HTTP framework adapter (Express or Hono middleware from SDK)
- This is out of scope for this project but architecturally possible with the same server code

**If the MCP SDK releases v2 stable:**
- Import paths change from `@modelcontextprotocol/sdk/server/mcp.js` to `@modelcontextprotocol/server`
- Tool registration API changes from `server.registerTool()` to a potentially different pattern
- Migration should be straightforward -- same concepts, different import paths
- Wait for stable release and migration guide before upgrading

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@modelcontextprotocol/sdk@1.26.x` | `zod@>=3.25` | SDK internally uses `zod/v4` imports but maintains backward compat. Install `zod@3` per official quickstart. |
| `@modelcontextprotocol/sdk@1.26.x` | Node.js >=18 | SDK uses ESM and modern Node APIs. Node 22 LTS recommended. |
| `typescript@5.9.x` | `@types/node@22.x` | Match @types/node to your Node.js major version. |
| `"module": "Node16"` in tsconfig | `"type": "module"` in package.json | Both must be set. ESM is mandatory for the SDK. |

## Deploy Configuration

### Claude Desktop Config (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["/Users/mikhailgasanov/lightdash-mcp/build/index.js"],
      "env": {
        "LIGHTDASH_API_KEY": "<your-personal-access-token>",
        "LIGHTDASH_API_URL": "<your-lightdash-instance-url>"
      }
    }
  }
}
```

### Build and Deploy Script

```bash
# Build in source directory
cd ~/Documents/Lightdash\ MCP && npm run build

# Deploy compiled output
cp -r build/ ~/lightdash-mcp/build/
cp package.json ~/lightdash-mcp/
cp -r node_modules/ ~/lightdash-mcp/node_modules/
```

Or use a `deploy` script in package.json:
```json
"scripts": {
  "build": "tsc",
  "deploy": "npm run build && rsync -av --delete build/ ~/lightdash-mcp/build/ && cp package.json ~/lightdash-mcp/ && rsync -av --delete node_modules/ ~/lightdash-mcp/node_modules/"
}
```

## Sources

- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- v1.26.0 current, v2 pre-alpha; confirmed v1.x is production-recommended (HIGH confidence)
- [Official MCP "Build a Server" Tutorial](https://modelcontextprotocol.io/docs/develop/build-server) -- exact import paths, tsconfig, package.json, tool registration API, and server bootstrap (HIGH confidence)
- [MCP SDK npm page](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.26.0 published Feb 4, 2026; 24,468 dependents; zod peer dependency confirmed (HIGH confidence)
- [Zod npm page](https://www.npmjs.com/package/zod) -- v4.3.6 is latest stable; SDK compat with zod >=3.25 confirmed via GitHub issues (HIGH confidence)
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) -- Node 22 Maintenance LTS until April 2027, Node 24 Active LTS (HIGH confidence)
- [TypeScript npm page](https://www.npmjs.com/package/typescript) -- v5.9 is current stable; TS 7 native preview exists but not production-ready (HIGH confidence)
- [MCP Inspector GitHub](https://github.com/modelcontextprotocol/inspector) -- interactive browser-based MCP server testing tool (HIGH confidence)
- [Lightdash API docs](https://docs.lightdash.com/api-reference/v1/introduction) -- Personal Access Token auth, OpenAPI-documented endpoints (MEDIUM confidence -- did not verify full endpoint list)
- [Lightdash MCP PROJECT.md](/Users/mikhailgasanov/Documents/Lightdash MCP/.planning/PROJECT.md) -- `Authorization: ApiKey <token>` header format, `{results: ...}` wrapper, required tools list (HIGH confidence)

---
*Stack research for: Lightdash MCP Server (TypeScript, stdio transport)*
*Researched: 2026-02-10*
