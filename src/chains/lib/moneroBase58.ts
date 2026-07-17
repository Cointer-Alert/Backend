/**
 * Monero's base58 is block-encoded (CryptoNote's variant), NOT the single
 * big-integer encoding used by Bitcoin/base58check. Input is split into
 * 8-byte blocks, each encoded to 11 characters; a final partial block of N
 * bytes (1-7) encodes to a fixed, smaller character count per this table
 * rather than a variable one. See monero/src/common/base58.cpp.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP = new Map([...ALPHABET].map((c, i) => [c, i]));
const FULL_BLOCK_SIZE = 8;
const FULL_ENCODED_BLOCK_SIZE = 11;
const ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];

function decodeBlock(encoded: string, decodedSize: number): Uint8Array | null {
  if (encoded.length === 0 || encoded.length > FULL_ENCODED_BLOCK_SIZE) return null;
  let num = 0n;
  for (const char of encoded) {
    const digit = ALPHABET_MAP.get(char);
    if (digit === undefined) return null;
    num = num * 58n + BigInt(digit);
  }
  const out = new Uint8Array(decodedSize);
  for (let i = decodedSize - 1; i >= 0; i--) {
    out[i] = Number(num & 0xffn);
    num >>= 8n;
  }
  return num === 0n ? out : null;
}

export function moneroBase58Decode(address: string): Uint8Array | null {
  const fullBlockCount = Math.floor(address.length / FULL_ENCODED_BLOCK_SIZE);
  const lastBlockSize = address.length % FULL_ENCODED_BLOCK_SIZE;
  const lastBlockDecodedSize = ENCODED_BLOCK_SIZES.indexOf(lastBlockSize);
  if (lastBlockDecodedSize < 0) return null;

  const decodedSize = fullBlockCount * FULL_BLOCK_SIZE + lastBlockDecodedSize;
  const out = new Uint8Array(decodedSize);

  for (let i = 0; i < fullBlockCount; i++) {
    const chunk = address.slice(i * FULL_ENCODED_BLOCK_SIZE, (i + 1) * FULL_ENCODED_BLOCK_SIZE);
    const decoded = decodeBlock(chunk, FULL_BLOCK_SIZE);
    if (!decoded) return null;
    out.set(decoded, i * FULL_BLOCK_SIZE);
  }

  if (lastBlockSize > 0) {
    const chunk = address.slice(fullBlockCount * FULL_ENCODED_BLOCK_SIZE);
    const decoded = decodeBlock(chunk, lastBlockDecodedSize);
    if (!decoded) return null;
    out.set(decoded, fullBlockCount * FULL_BLOCK_SIZE);
  }

  return out;
}
