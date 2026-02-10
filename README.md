# Lightdash MCP Server

Give Claude Desktop read-only access to your Lightdash projects, charts, dashboards, and queries.

## Setup

### Step 1: Get a Lightdash Personal Access Token

1. Open your Lightdash instance in a browser
2. Click your **avatar** in the bottom-left corner, then select **Settings**
3. In the left sidebar, click **Personal Access Tokens**
4. Click **Generate new token**, give it a name (e.g., "Claude Desktop"), and click **Create token**
5. **Copy the token immediately** -- you won't be able to see it again

### Step 2: Add to Claude Desktop

Open Claude Desktop. Go to **Settings** > **Developer** > **Edit Config**.

Replace the file contents with:

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "npx",
      "args": ["-y", "lightdash-mcp"],
      "env": {
        "LIGHTDASH_API_KEY": "your-token-here",
        "LIGHTDASH_API_URL": "https://your-lightdash-instance.com"
      }
    }
  }
}
```

- **`your-token-here`** -- the token from Step 1
- **`https://your-lightdash-instance.com`** -- your Lightdash URL (do NOT add `/api/v1`, the server adds it automatically)

If you already have other MCP servers, add just the `"lightdash": { ... }` block inside your existing `mcpServers` object.

### Step 3: Restart and verify

Quit Claude Desktop completely (**Cmd + Q**), reopen it, and ask Claude:

> Use the lightdash_ping tool to test the connection.

If Claude confirms the connection is working, you're all set.

## Available Tools

| Tool | What It Does |
|------|-------------|
| `lightdash_ping` | Test that the connection to Lightdash is working |
| `list_projects` | List all projects in your Lightdash organization |
| `list_spaces` | List spaces within a project |
| `search_charts` | Search for charts by name |
| `list_dashboards` | List dashboards, optionally filtered by name |
| `list_explores` | List available explores (data models) in a project |
| `get_chart` | Get the full configuration of a saved chart |
| `get_chart_results` | Run a saved chart and get its data |
| `get_explore` | Get the schema of an explore (dimensions and metrics) |
| `run_raw_query` | Run a custom query against an explore with filters and sorts |

## Troubleshooting

<details>
<summary><strong>"Could not connect to MCP server"</strong></summary>

Check that **Node.js v18+** is installed by running `node --version` in Terminal. npx requires Node.js. If you get "command not found", install Node.js from [nodejs.org](https://nodejs.org/) (choose the **LTS** version).

After installing, close and reopen Terminal, then restart Claude Desktop.

</details>

<details>
<summary><strong>"401 Unauthorized" errors</strong></summary>

Your Personal Access Token is invalid or expired. Go to Lightdash **Settings** > **Personal Access Tokens** and create a new one. Then update `LIGHTDASH_API_KEY` in your Claude Desktop config with the new token.

</details>

<details>
<summary><strong>"ECONNREFUSED" or "ENOTFOUND" errors</strong></summary>

Your `LIGHTDASH_API_URL` is wrong. Common mistakes:

- Adding `/api/v1` at the end (don't -- the server adds this automatically)
- Using `http://` instead of `https://`
- Typos in the URL

</details>

## Alternative: Manual Install

If you prefer to clone the repository instead of using npx:

```
git clone https://github.com/timeleft-dev/lightdash-mcp.git
cd lightdash-mcp
npm install
npm run build
```

Then use this Claude Desktop config instead (replace `/FULL/PATH/TO/` with the actual path):

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["/FULL/PATH/TO/lightdash-mcp/build/index.js"],
      "env": {
        "LIGHTDASH_API_KEY": "your-token-here",
        "LIGHTDASH_API_URL": "https://your-lightdash-instance.com"
      }
    }
  }
}
```

## Optional: Improve Claude's Output

You can add instructions to Claude Desktop's preferences so Claude formats Lightdash data nicely by default.

### CSV Tables

Go to Claude Desktop **Settings** > **General**. In the "How would you like Claude to behave?" box, add:

```
When showing tabular data from Lightdash, format it as a CSV code block for easy copying.
```

### Chart Artifacts

In the same preferences box, also add:

```
When I ask for charts or visualizations of Lightdash data, create them as artifacts using Recharts (a React charting library that Claude Desktop supports natively).
```

## License

MIT
