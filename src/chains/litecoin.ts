import type { ChainAdapter } from "./index";
import { isValidBase58Check } from "./lib/base58";
import { isValidSegwitAddress } from "./lib/segwit";

function validate(address: string): boolean {
  if (typeof address !== "string" || address.length < 26 || address.length > 90) return false;
  if (address.toLowerCase().startsWith("ltc1")) {
    return isValidSegwitAddress(address, "ltc");
  }
  if (address.startsWith("L") || address.startsWith("M") || address.startsWith("3")) {
    return isValidBase58Check(address, [0x30, 0x32, 0x05]);
  }
  return false;
}

function normalize(address: string): string {
  return address.toLowerCase().startsWith("ltc1") ? address.toLowerCase() : address;
}

export const litecoin: ChainAdapter = {
  id: "litecoin",
  displayName: "Litecoin",
  asset: "LTC",
  validate,
  normalize,
};
