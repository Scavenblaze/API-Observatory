import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePublicAddress, SSRFError } from "./ssrf-protection";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn()
}));

vi.mock("node:dns/promises", () => ({
  lookup: mocks.lookup
}));



describe("SSRF Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects localhost", async () => {
    await expect(resolvePublicAddress("localhost")).rejects.toThrow(SSRFError);

    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("rejects subdomains of localhost", async () => {
    await expect(resolvePublicAddress("internal.localhost")).rejects.toThrow("Local hostnames are not allowed");
  });

  it("rejects private IPv4 addresses", async () => {
    const privateAddresses = [
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1"
    ];

    for(const address of privateAddresses){
      await expect(resolvePublicAddress(address)).rejects.toThrow(SSRFError);
    }
  });

  it("rejects loopback IPv4 addresses", async () => {
    await expect(resolvePublicAddress("127.0.0.1")).rejects.toThrow(SSRFError);
  });

  it("rejects link-local and cloud metadata addresses", async () => {
    await expect(resolvePublicAddress("169.254.169.254")).rejects.toThrow(SSRFError);
  });

  it("rejects IPv6 loopback addresses", async () => {
    await expect(resolvePublicAddress("::1")).rejects.toThrow(SSRFError);
  });

  it("rejects IPv4-mapped IPv6 addresses pointing to private IPs", async () => {
    await expect(resolvePublicAddress("::ffff:127.0.0.1")).rejects.toThrow(SSRFError);
  });

  it("accepts a public IPv4 address", async () => {
    const result = await resolvePublicAddress("8.8.8.8");

    expect(result).toEqual({
      address: "8.8.8.8",
      family: 4
    });

    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("accepts a hostname resolving to a public IP", async () => {
    mocks.lookup.mockResolvedValue([
      {
        address: "8.8.8.8",
        family: 4
      },
    ]);

    const result = await resolvePublicAddress("example.com");

    expect(result).toEqual({
      address: "8.8.8.8",
      family: 4
    });

    expect(mocks.lookup).toHaveBeenCalledWith("example.com", {
      all: true,
      verbatim: true
    });
  });

  it("rejects a hostname if any resolved address is private", async () => {
    mocks.lookup.mockResolvedValue([
      {
        address: "8.8.8.8",
        family: 4
      },
      {
        address: "192.168.1.1",
        family: 4
      }
    ]);

    await expect(resolvePublicAddress("example.com")).rejects.toThrow("Monitor hostname resolves to a restricted IP address");
  });

  it("rejects a hostname that fails DNS resolution", async () => {
    mocks.lookup.mockRejectedValue(new Error("DNS lookup failed"));

    await expect(resolvePublicAddress("example.com")).rejects.toThrow("Unable to resolve monitor hostname");
  });

  it("rejects a hostname that resolves to no addresses", async () => {
    mocks.lookup.mockResolvedValue([]);

    await expect(resolvePublicAddress("example.com")).rejects.toThrow("Hostname did not resolve to an IP address");
  });

  it("rejects a hostname that resolves to an invalid IP address", async () => {
    mocks.lookup.mockResolvedValue([
      {
        address: "not-an-ip-address",
        family: 4,
      },
    ]);

    await expect(
      resolvePublicAddress("example.com")
    ).rejects.toThrow(
      "Monitor hostname resolves to a restricted IP address"
    );
  });

  it("correctly handles public IPv6 DNS results", async () => {
    mocks.lookup.mockResolvedValue([
      {
        address: "2606:4700:4700::1111",
        family: 6,
      },
    ]);

    const result = await resolvePublicAddress("example.com");

    expect(result).toEqual({
      address: "2606:4700:4700::1111",
      family: 6,
    });
  });
});