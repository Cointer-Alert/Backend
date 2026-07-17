const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_MAP = new Map([...BECH32_CHARSET].map((c, i) => [c, i]));
const BECH32M_CONST = 0x2bc830a3;

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GEN[i]!;
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function bech32Decode(
  address: string,
): { hrp: string; data: number[]; spec: "bech32" | "bech32m" } | null {
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) return null;
  const addr = address.toLowerCase();
  const sep = addr.lastIndexOf("1");
  if (sep < 1 || sep + 7 > addr.length || addr.length > 90) return null;
  const hrp = addr.slice(0, sep);
  const data: number[] = [];
  for (const char of addr.slice(sep + 1)) {
    const v = BECH32_MAP.get(char);
    if (v === undefined) return null;
    data.push(v);
  }
  const check = bech32Polymod([...hrpExpand(hrp), ...data]);
  if (check === 1) return { hrp, data: data.slice(0, -6), spec: "bech32" };
  if (check === BECH32M_CONST) return { hrp, data: data.slice(0, -6), spec: "bech32m" };
  return null;
}

function convertBits(data: number[], from: number, to: number): number[] | null {
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
  if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) return null;
  return out;
}

export function isValidSegwitAddress(address: string, hrp: string): boolean {
  const decoded = bech32Decode(address);
  if (!decoded || decoded.hrp !== hrp) return false;
  const [version, ...rest] = decoded.data;
  if (version === undefined || version > 16) return false;
  if (version === 0 && decoded.spec !== "bech32") return false;
  if (version > 0 && decoded.spec !== "bech32m") return false;
  const program = convertBits(rest, 5, 8);
  if (!program || program.length < 2 || program.length > 40) return false;
  if (version === 0 && program.length !== 20 && program.length !== 32) return false;
  return true;
}
