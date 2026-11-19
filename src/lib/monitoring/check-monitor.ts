import { Agent, fetch } from "undici";
import { performance } from "node:perf_hooks";
import { resolvePublicAddress, SSRFError } from "@/lib/monitoring/ssrf-protection";

type CheckMonitorInput = {
  url: string;
  method: "GET" | "HEAD";
  timeoutMs: number;
  expectedStatus: number;
  latencyThresholdMs: number;
};

type CheckMonitorResult = {
  statusCode: number | null;
  latencyMs: number;
  success: boolean;
  errorType: string | null;
  errorMessage: string | null;
  responseSize: number | null;
};

const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT"
]);

const getErrorCode = (error: unknown): string | null => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while(current instanceof Error && !visited.has(current)){
    visited.add(current);
    const code = (current as Error & { code?: unknown }).code;

    if(typeof code === "string"){
      return code;
    }

    current = (current as Error & { cause?: unknown }).cause;
  }
  return null;
}

const isNetworkError = (error: unknown): boolean => {
  const code = getErrorCode(error);

  return code !== null && NETWORK_ERROR_CODES.has(code);
}

export async function checkMonitor({url, method, timeoutMs, expectedStatus, latencyThresholdMs}: CheckMonitorInput): Promise<CheckMonitorResult>{
  const startedAt = performance.now();

  let agent: Agent | undefined;

  try{
    const parsedUrl = new URL(url);

    if(!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password){
      throw new SSRFError("Only HTTP and HTTPS URLs without credentials are allowed");
    }

    // Validate the destination before connecting
    const pinnedAddress = await resolvePublicAddress(parsedUrl.hostname);

    // Pin the HTTP connection to the validated IP. The original URL hostname is retained for Host and TLS SNI.
    const pinnedLookup = (_hostname: string, options: number | { all?: boolean }, callback: (...args: unknown[]) => void) => {
      if(typeof options === "object" && options.all){
        callback(null, [pinnedAddress]);
      } else{
        callback(null, pinnedAddress.address, pinnedAddress.family);
      }
    };

    agent = new Agent({
      connect: {
        lookup: pinnedLookup as never
      }
    });

    const response = await fetch(parsedUrl, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      dispatcher: agent
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    // Do not follow redirects. A redirect could point to a private address or another destination that has not been validated.
    if(response.status >= 300 && response.status < 400){
      await response.body?.cancel();

      return{
        statusCode: response.status,
        latencyMs,
        success: false,
        errorType: "REDIRECT_BLOCKED",
        errorMessage: "Redirect responses are not allowed",
        responseSize: null
      };
    }

    const contentLength = response.headers.get("content-length");
    const parsedSize = contentLength && /^\d+$/.test(contentLength) ? Number(contentLength) : null;

    const responseSize = parsedSize !== null && Number.isSafeInteger(parsedSize) ? parsedSize : null;

    // We only measure response-header latency, so don't download the response body.
    await response.body?.cancel();

    const statusMatches = response.status === expectedStatus;
    const latencyMatches = latencyMs <= latencyThresholdMs;

    const success = statusMatches && latencyMatches;

    return{
      statusCode: response.status,
      latencyMs,
      success,
      errorType: success
        ? null
        : !statusMatches
          ? "UNEXPECTED_STATUS"
          : "LATENCY_EXCEEDED",
      errorMessage: success
        ? null
        : !statusMatches
          ? `Expected HTTP ${expectedStatus}, received ${response.status}`
          : `Latency exceeded ${latencyThresholdMs}ms`,
      responseSize
    };
  } catch(error){
    const latencyMs = Math.round(performance.now() - startedAt);

    if(error instanceof SSRFError){
      return{
        statusCode: null,
        latencyMs,
        success: false,
        errorType: "SSRF_BLOCKED",
        errorMessage: error.message,
        responseSize: null
      };
    }

    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

    if(isTimeout){
      return{
        statusCode: null,
        latencyMs,
        success: false,
        errorType: "TIMEOUT",
        errorMessage: "Request timed out",
        responseSize: null
      };
    }

    if(isNetworkError(error)){
      return{
        statusCode: null,
        latencyMs,
        success: false,
        errorType: "NETWORK_ERROR",
        errorMessage: "Unable to reach monitor endpoint",
        responseSize: null,
      };
    }
    throw error;
  } finally{
    if (agent) {
      await agent.close().catch((error) => {
        console.error("Failed to close monitor HTTP agent:", error);
      });
    }
  }
}