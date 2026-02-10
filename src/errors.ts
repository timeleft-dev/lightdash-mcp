/**
 * Error types, sanitization, and tool handler wrapper for MCP tools.
 *
 * - LightdashApiError: typed API error with safe message extraction
 * - sanitizeErrorMessage: strips API keys, URLs, and stack traces
 * - formatErrorForLLM: converts any error to a safe, informative string
 * - wrapToolHandler: wraps tool callbacks in try/catch, returns isError format
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./logger.js";

/**
 * Error class for Lightdash API HTTP errors.
 * Extracts a safe message from the JSON response body without leaking URLs or keys.
 */
export class LightdashApiError extends Error {
  public readonly statusCode: number;
  public readonly safeMessage: string;

  constructor(statusCode: number, rawBody: string) {
    let safeMessage: string;
    try {
      const parsed = JSON.parse(rawBody);
      safeMessage =
        parsed.error?.message || parsed.message || `HTTP ${statusCode}`;
    } catch {
      safeMessage = `HTTP ${statusCode}`;
    }

    super(safeMessage);
    this.name = "LightdashApiError";
    this.statusCode = statusCode;
    this.safeMessage = safeMessage;
  }
}

/**
 * Sanitize an error message by removing sensitive information:
 * - API key tokens
 * - HTTP/HTTPS URLs
 * - Stack trace frames
 */
export function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/ApiKey\s+\S+/gi, "ApiKey [REDACTED]")
    .replace(/https?:\/\/[^\s]+/gi, "[URL REDACTED]")
    .replace(/\s*at\s+.+\(.+\)/g, "");
}

/**
 * Format any error into a safe, informative string suitable for LLM consumption.
 * Never includes API keys, URLs, or stack traces.
 */
export function formatErrorForLLM(error: unknown): string {
  if (error instanceof LightdashApiError) {
    return `Lightdash API error (${error.statusCode}): ${error.safeMessage}`;
  }
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return "Request timed out. The Lightdash instance may be slow or unreachable. Try again or check the server status.";
    }
    return sanitizeErrorMessage(error.message);
  }
  return "An unexpected error occurred. Check server logs for details.";
}

/**
 * Wrap a tool handler function in try/catch error handling.
 * On success: returns the handler's result.
 * On error: returns { isError: true, content: [{ type: "text", text: ... }] }
 * Full error details are logged to stderr for debugging.
 */
export function wrapToolHandler<T>(
  handler: (args: T) => Promise<CallToolResult>
): (args: T) => Promise<CallToolResult> {
  return async (args: T): Promise<CallToolResult> => {
    try {
      return await handler(args);
    } catch (error) {
      log.error("Tool handler error:", error);
      return {
        isError: true,
        content: [{ type: "text", text: formatErrorForLLM(error) }],
      };
    }
  };
}
