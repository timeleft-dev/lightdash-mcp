/**
 * Centralized HTTP client for the Lightdash API.
 *
 * Every tool uses LightdashClient rather than calling fetch directly.
 * Handles:
 * - Base URL normalization with /api/v1 auto-append (INFRA-03)
 * - Authorization: ApiKey header injection (INFRA-04)
 * - Response envelope unwrapping ({ status, results } -> results) (INFRA-05)
 * - Configurable timeouts with 30s default via AbortSignal.timeout (INFRA-08)
 * - HTTP error detection with LightdashApiError (INFRA-07)
 */

import { LightdashApiError } from "./errors.js";
import { log } from "./logger.js";

export interface LightdashClientConfig {
  baseUrl: string;
  apiKey: string;
  defaultTimeout?: number;
}

export class LightdashClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly defaultTimeout: number;

  constructor(config: LightdashClientConfig) {
    // Strip trailing slashes
    let url = config.baseUrl.replace(/\/+$/, "");

    // Auto-append /api/v1 if not already present (INFRA-03)
    if (!url.endsWith("/api/v1")) {
      url += "/api/v1";
    }

    this.baseUrl = url;

    // Authorization header with ApiKey scheme (INFRA-04)
    this.headers = {
      Authorization: `ApiKey ${config.apiKey}`,
      "Content-Type": "application/json",
    };

    // Default 30s timeout (INFRA-08)
    this.defaultTimeout = config.defaultTimeout ?? 30_000;
  }

  /**
   * Perform a GET request to the Lightdash API.
   * @param path - API path starting with / (e.g., "/org/projects")
   * @param timeoutMs - Optional per-request timeout override
   * @returns Unwrapped results from the API response envelope
   */
  async get<T>(path: string, timeoutMs?: number): Promise<T> {
    log.debug(`GET ${path}`);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers,
      signal: AbortSignal.timeout(timeoutMs ?? this.defaultTimeout),
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Perform a POST request to the Lightdash API.
   * @param path - API path starting with / (e.g., "/org/projects")
   * @param body - Optional request body (will be JSON-stringified)
   * @param timeoutMs - Optional per-request timeout override
   * @returns Unwrapped results from the API response envelope
   */
  async post<T>(
    path: string,
    body?: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    log.debug(`POST ${path}`);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs ?? this.defaultTimeout),
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Handle the API response: check for errors and unwrap the envelope.
   * Non-2xx responses throw LightdashApiError with safe message extraction.
   * Successful responses are unwrapped from { status, results } to just results.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new LightdashApiError(response.status, text);
    }

    const json = (await response.json()) as { status: string; results: T };
    return json.results;
  }
}
