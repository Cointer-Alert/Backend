import { describe, expect, test } from "bun:test";
import { base } from "../chains/base";

const ADDR = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

describe("base address validation", () => {
  test("accepts a checksummed address", () => {
    expect(base.validate(ADDR)).toBe(true);
  });

  test("accepts all-lowercase and all-uppercase hex", () => {
    expect(base.validate(ADDR.toLowerCase())).toBe(true);
    expect(base.validate(`0x${ADDR.slice(2).toUpperCase()}`)).toBe(true);
  });

  test("rejects wrong length", () => {
    expect(base.validate(ADDR.slice(0, -1))).toBe(false);
    expect(base.validate(`${ADDR}0`)).toBe(false);
  });

  test("rejects missing 0x prefix, non-hex, garbage and empty", () => {
    expect(base.validate(ADDR.slice(2))).toBe(false);
    expect(base.validate("0xZZdA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(false);
    expect(base.validate("not-an-address")).toBe(false);
    expect(base.validate("")).toBe(false);
  });

  test("normalizes to lowercase", () => {
    expect(base.normalize(ADDR)).toBe(ADDR.toLowerCase());
  });
});
