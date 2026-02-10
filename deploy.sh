#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$HOME/lightdash-mcp"

echo "Building TypeScript..."
npm run build

echo "Installing production dependencies..."
npm ci --omit=dev

echo "Deploying to $DEPLOY_DIR..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r build "$DEPLOY_DIR/"
cp -r node_modules "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"

echo "Restoring dev dependencies..."
npm ci

echo ""
echo "Deployed successfully to $DEPLOY_DIR"
echo ""
echo "Add this to your Claude Desktop config"
echo "(~/Library/Application Support/Claude/claude_desktop_config.json on macOS):"
echo ""
cat << CONFIG
{
  "mcpServers": {
    "lightdash": {
      "command": "node",
      "args": ["$DEPLOY_DIR/build/index.js"],
      "env": {
        "LIGHTDASH_API_KEY": "your-lightdash-personal-access-token",
        "LIGHTDASH_API_URL": "https://your-lightdash-instance.com"
      }
    }
  }
}
CONFIG
