import type { ChainAdapter } from "./index";

function validate(address: string): boolean {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

function normalize(address: string): string {
  return address.toLowerCase();
}

export const base: ChainAdapter = {
  id: "base",
  displayName: "Base",
  asset: "ETH",
  validate,
  normalize,
};
