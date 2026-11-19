import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as ipaddr from "ipaddr.js";

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export class SSRFError extends Error{
  constructor(message: string){
    super(message);
    this.name = "SSRFError";
  }
}

const isPublicAddress = (address: string): boolean => {
  try{
    let parsed = ipaddr.parse(address);

    // Convert IPv4-mapped IPv6 addresses before checking them
    if(parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()){
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }

    // ipaddr.js classifies private, loopback, link-local, multicast, reserved and other special ranges separately
    return parsed.range() === "unicast";
  } catch{
    return false;
  }
}

export async function resolvePublicAddress(hostname: string,): Promise<ResolvedAddress>{
  const normalizedHost = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  if(!normalizedHost || normalizedHost === "localhost" || normalizedHost.endsWith(".localhost") || normalizedHost.endsWith(".local") || normalizedHost.endsWith(".internal")){
    throw new SSRFError("Local hostnames are not allowed");
  }

  const literalFamily = isIP(normalizedHost);

  let addresses: ResolvedAddress[];

  if(literalFamily){
    addresses = [
      {
        address: normalizedHost,
        family: literalFamily as 4 | 6
      }
    ];
  } else{
    try{
    const resolved = await lookup(normalizedHost, {
        all: true,
        verbatim: true
    });

    addresses = resolved.map((entry) => ({
        address: entry.address,
        family: entry.family === 6 ? 6 : 4
    }));
    } catch {
      throw new SSRFError("Unable to resolve monitor hostname");
    }
  }

  if(addresses.length === 0){
    throw new SSRFError("Hostname did not resolve to an IP address");
  }

  // Reject the entire hostname if ANY returned address is unsafe
  // This prevents an unsafe DNS answer from being hidden among otherwise public addresses.
  for(const entry of addresses){
    if(!isPublicAddress(entry.address)){
      throw new SSRFError("Monitor hostname resolves to a restricted IP address");
    }
  }

  // Return one validated address. The caller must pin this address for the actual HTTP connection.
  return addresses[0];
}
