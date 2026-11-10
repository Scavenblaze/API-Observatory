import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkMonitor } from "./check-monitor";
import { SSRFError } from "@/lib/monitoring/ssrf-protection";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  resolvePublicAddress: vi.fn(),
  agentConstructor: vi.fn(),
  agentClose: vi.fn()
}));

vi.mock("undici", () => ({
  fetch: mocks.fetch,
  Agent: class{
    constructor(options: unknown) {
      mocks.agentConstructor(options);
    }

    close(){
      return mocks.agentClose();
    }
  }
}));

vi.mock("@/lib/monitoring/ssrf-protection", () => ({
  resolvePublicAddress: mocks.resolvePublicAddress,
  SSRFError: class SSRFError extends Error{
    constructor(message: string){
      super(message);
      this.name = "SSRFError";
    }
  }
}));


const input = {
  url: "https://example.com",
  method: "GET" as const,
  timeoutMs: 5000,
  expectedStatus: 200,
  latencyThresholdMs: 1000
};

const mockResponse = (status: number, contentLength = "1024") => {
  return{
    status,
    headers: new Headers({
      "content-length": contentLength
    }),
    body: {
      cancel: vi.fn().mockResolvedValue(undefined)
    }
  };
}

describe("Check Monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolvePublicAddress.mockResolvedValue({
      address: "93.184.216.34",
      family: 4
    });

    mocks.fetch.mockResolvedValue(mockResponse(200));
    mocks.agentClose.mockResolvedValue(undefined);
  });

  it("returns success when the expected status is received", async () => {
    const result = await checkMonitor(input);

    expect(result).toMatchObject({
      statusCode: 200,
      success: true,
      errorType: null,
      errorMessage: null,
      responseSize: 1024 
    });

    expect(mocks.resolvePublicAddress).toHaveBeenCalledWith("example.com");

    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("returns failure when the status code is unexpected", async () => {
    mocks.fetch.mockResolvedValue(mockResponse(503));

    const result = await checkMonitor(input);

    expect(result).toMatchObject({
      statusCode: 503,
      success: false,
      errorType: "UNEXPECTED_STATUS",
      errorMessage: "Expected HTTP 200, received 503"
    });
  });

  it("returns failure when latency exceeds the threshold", async () => {
    const performanceSpy = vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(1200);

    const result = await checkMonitor({
      ...input,
      latencyThresholdMs: 500
    });

    expect(result).toMatchObject({
      statusCode: 200,
      latencyMs: 1100,
      success: false,
      errorType: "LATENCY_EXCEEDED",
      errorMessage: "Latency exceeded 500ms"
    });

    performanceSpy.mockRestore();
  });

  it("returns TIMEOUT when the request times out", async () => {
    const timeoutError = new Error("Request timed out");
    timeoutError.name = "TimeoutError";

    mocks.fetch.mockRejectedValue(timeoutError);

    const result = await checkMonitor(input);

    expect(result).toMatchObject({
      statusCode: null,
      success: false,
      errorType: "TIMEOUT",
      errorMessage: "Request timed out",
      responseSize: null
    });
  });

  it("blocks redirect responses", async () => {
    mocks.fetch.mockResolvedValue(mockResponse(301));

    const result = await checkMonitor(input);

    expect(result).toMatchObject({
      statusCode: 301,
      success: false,
      errorType: "REDIRECT_BLOCKED",
      errorMessage: "Redirect responses are not allowed",
      responseSize: null
    });
  });

  it("returns SSRF_BLOCKED when the destination is rejected", async () => {
    mocks.resolvePublicAddress.mockRejectedValue(new SSRFError("Local hostnames are not allowed"));

    const result = await checkMonitor({
      ...input,
      url: "http://localhost"
    });

    expect(result).toMatchObject({
      statusCode: null,
      success: false,
      errorType: "SSRF_BLOCKED",
      errorMessage: "Local hostnames are not allowed",
      responseSize: null
    });

    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns NETWORK_ERROR for other network failures", async () => {
    mocks.fetch.mockRejectedValue(new Error("Connection refused"));

    const result = await checkMonitor(input);

    expect(result).toMatchObject({
      statusCode: null,
      success: false,
      errorType: "NETWORK_ERROR",
      errorMessage: "Unable to reach monitor endpoint"
    });
  });

  it("closes the HTTP agent after a request", async () => {
    await checkMonitor(input);

    expect(mocks.agentClose).toHaveBeenCalledOnce();
  });

  it("logs an error when closing the HTTP agent fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.agentClose.mockRejectedValue(new Error("Agent Close Failed"));
    const result = await checkMonitor(input);

    expect(result.success).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to close monitor HTTP agent:", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("rejects URLs that do not use HTTP or HTTPS", async () => {
    const result = await checkMonitor({
      ...input,
      url: "ftp://example.com"
    });

    expect(result).toMatchObject({
      statusCode: null,
      success: false,
      errorType: "SSRF_BLOCKED",
      errorMessage: "Only HTTP and HTTPS URLs without credentials are allowed"
    });

    expect(mocks.resolvePublicAddress).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects URLs containing credentials", async () => {
    const result = await checkMonitor({
      ...input,
      url: "https://user:password@example.com"
    });

    expect(result).toMatchObject({
      statusCode: null,
      success: false,
      errorType: "SSRF_BLOCKED",
      errorMessage: "Only HTTP and HTTPS URLs without credentials are allowed"
    });

    expect(mocks.resolvePublicAddress).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("uses the validated IP address for both DNS lookup modes", async () => {
    await checkMonitor(input);

    const options = mocks.agentConstructor.mock.calls[0][0] as {
      connect: {
        lookup : (
          hostname: string,
          options: number | { all?: boolean },
          callback: (...args: unknown[]) => void) => void;
      };
    };

    const lookup = options.connect.lookup;
    const allCallback = vi.fn();
    lookup("example.com", { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, [
      {
        address: "93.184.216.34",
        family: 4
      },
    ]);

    const singleCallback = vi.fn();
    lookup("example.com", 4, singleCallback);
    expect(singleCallback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });

  it("returns null response size for an invalid content-length header", async () => {
    mocks.fetch.mockResolvedValue(mockResponse(200, "invalid"));

    const result = await checkMonitor(input);

    expect(result).toMatchObject({
      statusCode: 200,
      success: true,
      responseSize: null,
    });
  });

  it("returns null response size when content-length exceeds the safe integer range", async () => {
    mocks.fetch.mockResolvedValue(
      mockResponse(200, "9007199254740992")
    );

    const result = await checkMonitor(input);

    expect(result).toMatchObject({
      statusCode: 200,
      success: true,
      responseSize: null,
    });
  });
});
