import { describe, expect, test } from "bun:test";
import { solana } from "../chains/solana";

describe("solana address validation", () => {
  test("accepts a valid 32-byte base58 pubkey", () => {
    expect(solana.validate("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
    expect(solana.validate("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")).toBe(true);
  });

  test("rejects addresses that decode to the wrong byte length", () => {
    expect(solana.validate("1".repeat(30))).toBe(false);
  });

  test("accepts the system program address (32 zero bytes, 31 leading '1's)", () => {
    expect(solana.validate("1".repeat(31))).toBe(true);
  });

  test("rejects invalid base58 characters, garbage and empty", () => {
    expect(solana.validate("0OIl_invalid_chars_not_base58")).toBe(false);
    expect(solana.validate("not-an-address")).toBe(false);
    expect(solana.validate("")).toBe(false);
  });

  test("normalize is a no-op, case is significant in base58", () => {
    const addr = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    expect(solana.normalize(addr)).toBe(addr);
  });
});
