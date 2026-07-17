import { describe, expect, test } from "bun:test";
import { litecoin } from "../chains/litecoin";

describe("litecoin address validation", () => {
  test("accepts valid P2PKH (legacy L)", () => {
    expect(litecoin.validate("LaMT348PWRnrqeeWArpwQPbuanpXDZGEUz")).toBe(true);
  });

  test("accepts valid P2SH (M-prefix)", () => {
    expect(litecoin.validate("MQMcJhpWHYVeQArcZR3sBgyPZxxRtnH441")).toBe(true);
  });

  test("accepts legacy 3-prefix P2SH byte, shared historically with Bitcoin", () => {
    expect(litecoin.validate("3CDJNfdWX8m2NwuGUV3nhXHXEeLygMXoAj")).toBe(true);
  });

  test("accepts valid bech32 SegWit", () => {
    expect(litecoin.validate("ltc1qqqqsyqcyq5rqwzqfpg9scrgwpugpzysn3s44dy")).toBe(true);
    expect(litecoin.validate("LTC1QQQQSYQCYQ5RQWZQFPG9SCRGWPUGPZYSN3S44DY")).toBe(true);
  });

  test("rejects bad base58 checksum", () => {
    expect(litecoin.validate("LaMT348PWRnrqeeWArpwQPbuanpXDZGEUy")).toBe(false);
  });

  test("rejects bad bech32 checksum", () => {
    expect(litecoin.validate("ltc1qqqqsyqcyq5rqwzqfpg9scrgwpugpzysn3s44dz")).toBe(false);
  });

  test("rejects bitcoin bech32 hrp, mixed case, garbage and empty", () => {
    expect(litecoin.validate("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toBe(false);
    expect(litecoin.validate("ltc1qQqqsyqcyq5rqwzqfpg9scrgwpugpzysn3s44dy")).toBe(false);
    expect(litecoin.validate("not-an-address")).toBe(false);
    expect(litecoin.validate("")).toBe(false);
  });

  test("normalizes bech32 to lowercase, leaves base58 untouched", () => {
    expect(litecoin.normalize("LTC1QQQQSYQCYQ5RQWZQFPG9SCRGWPUGPZYSN3S44DY")).toBe(
      "ltc1qqqqsyqcyq5rqwzqfpg9scrgwpugpzysn3s44dy",
    );
    expect(litecoin.normalize("LaMT348PWRnrqeeWArpwQPbuanpXDZGEUz")).toBe(
      "LaMT348PWRnrqeeWArpwQPbuanpXDZGEUz",
    );
  });
});
