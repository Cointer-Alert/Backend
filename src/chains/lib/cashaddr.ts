const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const CHARSET_MAP = new Map([...CHARSET].map((c, i) => [c, i]));

const GENERATOR = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

function polymod(values: number[]): bigint {
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    for (let i = 0; i < 5; i++) {
      if ((c0 >> BigInt(i)) & 1n) c ^= GENERATOR[i]!;
    }
  }
  return c ^ 1n;
}

function prefixExpand(prefix: string): number[] {
  return [...prefix].map((c) => c.charCodeAt(0) & 0x1f);
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    if (value < 0 || value >> from !== 0) return null;
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    return null;
  }
  return out;
}

export type CashAddrType = "p2pkh" | "p2sh";

const HASH_SIZE_BITS: Record<number, number> = {
  0: 160,
  1: 192,
  2: 224,
  3: 256,
  4: 320,
  5: 384,
  6: 448,
  7: 512,
};

export function cashaddrEncode(prefix: string, type: CashAddrType, hash: Uint8Array): string {
  const sizeBits = hash.length * 8;
  const sizeCode = Object.entries(HASH_SIZE_BITS).find(([, bits]) => bits === sizeBits)?.[0];
  if (sizeCode === undefined) throw new Error(`Unsupported hash size ${hash.length} bytes`);
  const typeBits = type === "p2pkh" ? 0 : 8;
  const versionByte = typeBits | Number(sizeCode);
  const payload = convertBits([versionByte, ...hash], 8, 5, true);
  if (!payload) throw new Error("Failed to convert payload to 5-bit groups");

  const checksumInput = [...prefixExpand(prefix), 0, ...payload, 0, 0, 0, 0, 0, 0, 0, 0];
  const mod = polymod(checksumInput);
  const checksum: number[] = [];
  for (let i = 0; i < 8; i++) {
    checksum.push(Number((mod >> BigInt(5 * (7 - i))) & 0x1fn));
  }
  return `${prefix}:${[...payload, ...checksum].map((v) => CHARSET[v]).join("")}`;
}

export interface CashAddrDecoded {
  prefix: string;
  type: CashAddrType;
  hash: Uint8Array;
}

export function cashaddrDecode(address: string, defaultPrefix: string): CashAddrDecoded | null {
  let prefix: string;
  let payloadStr: string;
  const colonIdx = address.indexOf(":");
  if (colonIdx === -1) {
    prefix = defaultPrefix;
    payloadStr = address;
  } else {
    prefix = address.slice(0, colonIdx).toLowerCase();
    payloadStr = address.slice(colonIdx + 1);
  }
  if (payloadStr !== payloadStr.toLowerCase() && payloadStr !== payloadStr.toUpperCase())
    return null;
  payloadStr = payloadStr.toLowerCase();

  const values: number[] = [];
  for (const char of payloadStr) {
    const v = CHARSET_MAP.get(char);
    if (v === undefined) return null;
    values.push(v);
  }
  if (values.length < 8) return null;

  const checksumInput = [...prefixExpand(prefix), 0, ...values];
  if (polymod(checksumInput) !== 0n) return null;

  const payload5bit = values.slice(0, -8);
  const decoded = convertBits(payload5bit, 5, 8, false);
  if (!decoded || decoded.length === 0) return null;

  const versionByte = decoded[0]!;
  if ((versionByte & 0x80) !== 0) return null;
  const typeBits = (versionByte >> 3) & 0x0f;
  const sizeBits = HASH_SIZE_BITS[versionByte & 0x07];
  if (!sizeBits) return null;
  const hash = Uint8Array.from(decoded.slice(1));
  if (hash.length !== sizeBits / 8) return null;

  const type: CashAddrType | null = typeBits === 0 ? "p2pkh" : typeBits === 1 ? "p2sh" : null;
  if (!type) return null;

  return { prefix, type, hash };
}
