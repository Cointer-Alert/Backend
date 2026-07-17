const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = new Map([...BASE58_ALPHABET].map((c, i) => [c, i]));

export function base58Decode(input: string): Uint8Array | null {
  if (input.length === 0 || input.length > 90) return null;
  const bytes: number[] = [0];
  for (const char of input) {
    const value = BASE58_MAP.get(char);
    if (value === undefined) return null;
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of input) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

export function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(new Bun.CryptoHasher("sha256").update(data).digest());
}

export function isValidBase58Check(address: string, versions: number[]): boolean {
  const decoded = base58Decode(address);
  if (!decoded || decoded.length !== 25) return false;
  if (!versions.includes(decoded[0]!)) return false;
  const payload = decoded.slice(0, 21);
  const checksum = decoded.slice(21);
  const hash = sha256(sha256(payload));
  return checksum.every((b, i) => b === hash[i]);
}
