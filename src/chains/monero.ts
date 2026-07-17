import type { ChainAdapter } from "./index";
import { moneroBase58Decode } from "./lib/moneroBase58";

/**
 * Verifies Monero's block-encoded base58 (see lib/moneroBase58.ts) decodes
 * to the right total length with a known network/type prefix byte. This
 * does NOT verify Monero's Keccak-256 address checksum (Bun has no built-in
 * Keccak-256, only NIST SHA3-256, which uses different padding and would
 * silently produce wrong results) — a checksum-corrupted address still
 * passes this check. The real checksum is verified the first time
 * monero-wallet-rpc opens the wallet (see moneroWatcher.ts); a bad address
 * surfaces there as a watcher error rather than being silently accepted.
 */
const STANDARD_PREFIX = 18; // mainnet standard address
const SUBADDRESS_PREFIX = 42; // mainnet subaddress
const INTEGRATED_PREFIX = 19; // mainnet integrated address
const DECODED_LENGTH = 69; // 1 prefix + 32 spend key + 32 view key + 4 checksum
const INTEGRATED_DECODED_LENGTH = 77; // DECODED_LENGTH + 8-byte payment id

function validate(address: string): boolean {
  if (typeof address !== "string") return false;
  if (address.length < 95 || address.length > 106) return false;
  const decoded = moneroBase58Decode(address);
  if (!decoded) return false;
  const prefix = decoded[0];
  if (prefix === STANDARD_PREFIX || prefix === SUBADDRESS_PREFIX) {
    return decoded.length === DECODED_LENGTH;
  }
  if (prefix === INTEGRATED_PREFIX) {
    return decoded.length === INTEGRATED_DECODED_LENGTH;
  }
  return false;
}

function normalize(address: string): string {
  return address;
}

export const monero: ChainAdapter = {
  id: "monero",
  displayName: "Monero",
  asset: "XMR",
  validate,
  normalize,
};
