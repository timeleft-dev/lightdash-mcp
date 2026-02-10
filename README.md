# Lightdash MCP Server

Give Claude Desktop read-only access to your Lightdash projects, charts, dashboards, and queries.

## What This Does

This is an MCP server that connects Claude Desktop to your Lightdash instance. Once set up, you can ask Claude questions about your BI data -- list projects, search charts, explore dashboards, and even run custom queries -- all from a normal Claude Desktop conversation.

**What is MCP?** MCP (Model Context Protocol) is a protocol that lets Claude Desktop talk to external tools. This server is one of those tools.

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

## Prerequisites

Before you begin, make sure you have two things installed: **Node.js** and **Git**. Follow the steps below to check.

### Step 1: Check if Node.js is installed

Open Terminal (press **Cmd + Space**, type **Terminal**, press **Enter**) and run:

```
node --version
```

If you see a version number (v18 or higher), you're good. If you get "command not found", install Node.js from [https://nodejs.org/](https://nodejs.org/) -- download the **LTS** version and run the installer. After installing, close and reopen Terminal, then try the command again.

### Step 2: Check if Git is installed

In the same Terminal window, run:

```
git --version
```

If you see a version number, you're good. If not, macOS will prompt you to install Command Line Tools -- click **Install** and wait for it to finish.

## Installation

### Step 1: Open Terminal

Press **Cmd + Space** to open Spotlight, type **Terminal**, and press **Enter**.

### Step 2: Clone the repository

This downloads the server code to your computer. Run:

```
git clone https://github.com/timeleft-dev/lightdash-mcp.git
cd lightdash-mcp
```

The first command downloads the code. The second command moves you into the project folder.

### Step 3: Install dependencies

This installs the packages the server needs to run:

```
npm install
```

### Step 4: Build the server

This compiles the code into a form that can be executed:

```
npm run build
```

You should see no errors. If you do, make sure you completed the previous steps successfully.

## Creating a Lightdash Personal Access Token

Claude Desktop needs a Personal Access Token to read your Lightdash data. Here's how to create one:

1. Open your Lightdash instance in a browser (for example, `https://app.lightdash.cloud` or your company's self-hosted URL)
2. Click your **avatar or initials** in the bottom-left corner
3. Select **Settings**
4. In the left sidebar, click **Personal Access Tokens**
5. Click **Generate new token**
6. Give it a name (for example, "Claude Desktop")
7. Click **Create token**
8. **Copy the token immediately** -- you won't be able to see it again after leaving this page

> **Note:** This token gives read-only access to your Lightdash data. Keep it private and do not share it.

## Configure Claude Desktop

Now you'll tell Claude Desktop how to find and run the Lightdash MCP server.

### Step 1: Open Claude Desktop settings

Open Claude Desktop, then open **Settings** (click the gear icon, or press **Cmd + ,**).

### Step 2: Open the config file

Click **Developer** in the left sidebar, then click **Edit Config**. This opens a file called `claude_desktop_config.json` in a text editor.

### Step 3: Add the server configuration

**If this is your only MCP server** (replace the entire file contents with this):

```json
{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["/FULL/PATH/TO/lightdash-mcp/build/index.js"],
      "env": {
        "LIGHTDASH_API_KEY": "your-personal-access-token",
        "LIGHTDASH_API_URL": "https://your-lightdash-instance.com"
      }
    }
  }
}
```

**If you already have other MCP servers**, add just the `lightdash` entry inside the existing `mcpServers` object:

```json
"lightdash": {
  "command": "node",
  "args": ["/FULL/PATH/TO/lightdash-mcp/build/index.js"],
  "env": {
    "LIGHTDASH_API_KEY": "your-personal-access-token",
    "LIGHTDASH_API_URL": "https://your-lightdash-instance.com"
  }
}
```

**Important -- replace these three values:**

- **`/FULL/PATH/TO/lightdash-mcp`** -- Replace with the actual path where you cloned the repo. For example, if you cloned into your home directory, it would be: `/Users/yourname/lightdash-mcp/build/index.js`
- **`your-personal-access-token`** -- Replace with the token you copied from Lightdash in the previous section
- **`https://your-lightdash-instance.com`** -- Replace with your actual Lightdash URL (for example, `https://app.lightdash.cloud` or your self-hosted URL). **Do NOT include `/api/v1`** -- the server adds this automatically.

### Step 4: Save and restart

Save the file, then **quit Claude Desktop completely** (press **Cmd + Q**) and reopen it.

### Step 5: Verify the connection

Start a new chat in Claude Desktop and ask:

> Use the lightdash_ping tool to test the connection.

Claude should confirm the connection is working. If it does, you're all set!

## Troubleshooting

<details>
<summary><strong>"Could not connect to MCP server"</strong></summary>

The most common cause is a wrong path in the `args` field of your Claude Desktop config.

Double-check the path exists by running this in Terminal:

```
ls /FULL/PATH/TO/lightdash-mcp/build/index.js
```

Replace `/FULL/PATH/TO/` with your actual path. If you get "No such file or directory", the path is wrong.

Also check: did you run `npm run build`? The `build/` folder must exist before the server can start.

</details>

<details>
<summary><strong>"LIGHTDASH_API_KEY is not set" or "LIGHTDASH_API_URL is not set"</strong></summary>

You're missing the `env` section in your Claude Desktop config. Make sure both `LIGHTDASH_API_KEY` and `LIGHTDASH_API_URL` are present inside the `lightdash` server entry. See the [Configure Claude Desktop](#configure-claude-desktop) section above for the correct format.

</details>

<details>
<summary><strong>"401 Unauthorized" errors</strong></summary>

Your Personal Access Token is invalid or expired. Go back to Lightdash **Settings > Personal Access Tokens** and create a new one. Then update `LIGHTDASH_API_KEY` in your Claude Desktop config with the new token.

</details>

<details>
<summary><strong>"ECONNREFUSED" or "ENOTFOUND" errors</strong></summary>

Your `LIGHTDASH_API_URL` is wrong. Make sure it's your actual Lightdash URL (for example, `https://app.lightdash.cloud`).

Common mistakes:
- Adding `/api/v1` at the end (don't -- the server adds this automatically)
- Typos in the URL
- Using `http://` instead of `https://`

</details>

<details>
<summary><strong>Tools not showing up in Claude Desktop</strong></summary>

1. Restart Claude Desktop completely: press **Cmd + Q** to quit, then reopen it
2. Check that your config JSON is valid -- common issues are trailing commas or mismatched braces. You can validate your JSON at [jsonlint.com](https://jsonlint.com)

</details>

<details>
<summary><strong>"npm: command not found"</strong></summary>

Node.js is not installed. Download it from [https://nodejs.org/](https://nodejs.org/) (choose the **LTS** version), run the installer, and then **close and reopen Terminal** before trying again.

</details>

## Optional: Improve Claude's Output

You can add instructions to Claude Desktop's preferences so Claude formats Lightdash data nicely by default. These are optional but recommended.

### CSV Tables

Go to Claude Desktop **Settings > General**. In the "How would you like Claude to behave?" box, add:

```
When showing tabular data from Lightdash, format it as a CSV code block for easy copying.
```

This tells Claude to format query results as clean CSV tables that you can copy and paste into a spreadsheet.

### Chart Artifacts

In the same preferences box, also add:

```
When I ask for charts or visualizations of Lightdash data, create them as artifacts using Recharts (a React charting library that Claude Desktop supports natively).
```

With this preference, when you ask Claude to chart your Lightdash data, it will create interactive charts right in the conversation using Recharts.

## License

MIT
