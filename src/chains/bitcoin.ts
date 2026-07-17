import type { ChainAdapter } from "./index";
import { isValidBase58Check } from "./lib/base58";
import { isValidSegwitAddress } from "./lib/segwit";

function validate(address: string): boolean {
  if (typeof address !== "string" || address.length < 26 || address.length > 90) return false;
  if (address.startsWith("1") || address.startsWith("3")) {
    return isValidBase58Check(address, [0x00, 0x05]);
  }
  if (address.toLowerCase().startsWith("bc1")) {
    return isValidSegwitAddress(address, "bc");
  }
  return false;
}

function normalize(address: string): string {
  return address.toLowerCase().startsWith("bc1") ? address.toLowerCase() : address;
}

export const bitcoin: ChainAdapter = {
  id: "bitcoin",
  displayName: "Bitcoin",
  asset: "BTC",
  validate,
  normalize,
};
