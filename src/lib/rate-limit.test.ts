import { beforeEach, describe, expect, it, vi } from "vitest";
import { redis } from "@/lib/redis";
import { rateLimit } from "./rate-limit";

vi.mock("@/lib/redis", () => ({
  redis: {
    eval: vi.fn()
  }
}));

const mockedEval = vi.mocked(redis.eval);

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a request within the rate limit", async () => {
    mockedEval.mockResolvedValue([1, 60] as never);

    const result = await rateLimit("test:user-1", 5, 60);

    expect(result).toEqual({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetSeconds: 60
    });
  });

  it("allows requests up to the configured limit", async () => {
    mockedEval.mockResolvedValue([5, 30] as never);

    const result = await rateLimit("test:user-1", 5, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("rejects requests exceeding the configured limit", async () => {
    mockedEval.mockResolvedValue([6, 25] as never);

    const result = await rateLimit("test:user-1", 5, 60);

    expect(result).toEqual({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetSeconds: 25
    });
  });

  it("passes the correct Redis key and window duration", async () => {
    mockedEval.mockResolvedValue([1, 60] as never);

    await rateLimit("rate-limit:user-123", 10, 60);

    expect(mockedEval).toHaveBeenCalledWith(expect.any(String), 1, "rate-limit:user-123", 60);
  });

  it("returns zero remaining when the limit is reached", async () => {
    mockedEval.mockResolvedValue([5, 10] as never);

    const result = await rateLimit("test:user-1", 5, 60);

    expect(result.remaining).toBe(0);
  });

  it("does not return negative remaining requests", async () => {
    mockedEval.mockResolvedValue([100, 10] as never);

    const result = await rateLimit("test:user-1", 5, 60);

    expect(result.remaining).toBe(0);
    expect(result.allowed).toBe(false);
  });

  it("handles an expired or unavailable TTL without negative reset time", async () => {
    mockedEval.mockResolvedValue([6, -1] as never);

    const result = await rateLimit("test:user-1", 5, 60);

    expect(result.resetSeconds).toBe(0);
  });

  it("propagates Redis errors", async () => {
    mockedEval.mockRejectedValue(new Error("Redis connection failed"));

    await expect(rateLimit("test:user-1", 5, 60)).rejects.toThrow("Redis connection failed");
  });
});
