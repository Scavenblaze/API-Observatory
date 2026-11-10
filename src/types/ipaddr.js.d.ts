declare module "ipaddr.js"{
  export interface IPv4{
    kind(): "ipv4";
    range(): string;
  }

  export interface IPv6{
    kind(): "ipv6";
    range(): string;
    isIPv4MappedAddress(): boolean;
    toIPv4Address(): IPv4;
  }

  export function parse(address: string): IPv4 | IPv6;
}