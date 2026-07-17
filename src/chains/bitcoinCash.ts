import { cashaddrDecode, cashaddrEncode } from "./lib/cashaddr";
import { base58Decode, sha256 } from "./lib/base58";
import type { ChainAdapter } from "./index";

const PREFIX = "bitcoincash";

function decodeLegacy(address: string): { type: "p2pkh" | "p2sh"; hash: Uint8Array } | null {
  const decoded = base58Decode(address);
  if (!decoded || decoded.length !== 25) return null;
  const version = decoded[0]!;
  if (version !== 0x00 && version !== 0x05) return null;
  const payload = decoded.slice(0, 21);
  const checksum = decoded.slice(21);
  const hash = sha256(sha256(payload));
  if (!checksum.every((b, i) => b === hash[i])) return null;
  return { type: version === 0x00 ? "p2pkh" : "p2sh", hash: decoded.slice(1, 21) };
}

function validate(address: string): boolean {
  if (typeof address !== "string" || address.length === 0) return false;
  if (/^[13][a-zA-Z0-9]{25,34}$/.test(address)) {
    return decodeLegacy(address) !== null;
  }
  return cashaddrDecode(address, PREFIX) !== null;
}

function normalize(address: string): string {
  const legacy = /^[13][a-zA-Z0-9]{25,34}$/.test(address) ? decodeLegacy(address) : null;
  if (legacy) return cashaddrEncode(PREFIX, legacy.type, legacy.hash);
  const decoded = cashaddrDecode(address, PREFIX);
  if (decoded) return cashaddrEncode(PREFIX, decoded.type, decoded.hash);
  return address;
}

export const bitcoinCash: ChainAdapter = {
  id: "bitcoin-cash",
  displayName: "Bitcoin Cash",
  asset: "BCH",
  validate,
  normalize,
};
