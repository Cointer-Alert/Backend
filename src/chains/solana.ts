import type { ChainAdapter } from "./index";
import { base58Decode } from "./lib/base58";

function validate(address: string): boolean {
  if (typeof address !== "string" || address.length < 30 || address.length > 44) return false;
  return base58Decode(address)?.length === 32;
}

function normalize(address: string): string {
  return address;
}

export const solana: ChainAdapter = {
  id: "solana",
  displayName: "Solana",
  asset: "SOL",
  validate,
  normalize,
};
