/**
 * Stderr-only logging and stdout guard for MCP stdio transport.
 *
 * The MCP protocol uses stdout exclusively for JSON-RPC messages.
 * Any non-JSON-RPC output on stdout corrupts the protocol stream.
 * This module provides:
 * 1. setupStdoutGuard() - redirects console.log to stderr (call FIRST in index.ts)
 * 2. log - stderr-only logging with level prefixes
 */

const TAG = "[lightdash-mcp]";

/**
 * Override console.log to redirect to stderr.
 * MUST be called as the very first thing in index.ts, before any imports,
 * to catch third-party library initialization output.
 */
export function setupStdoutGuard(): void {
  console.log = (...args: unknown[]) => {
    console.error(TAG, "[redirected]", ...args);
  };
}

/**
 * Stderr-only logger. All methods write to stderr via console.error.
 * Safe to use anywhere without risking stdout pollution.
 */
export const log = {
  info: (...args: unknown[]): void => {
    console.error(TAG, "[INFO]", ...args);
  },
  warn: (...args: unknown[]): void => {
    console.error(TAG, "[WARN]", ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(TAG, "[ERROR]", ...args);
  },
  debug: (...args: unknown[]): void => {
    console.error(TAG, "[DEBUG]", ...args);
  },
};
