import { describe, expect, test } from "bun:test";
import { monero } from "../chains/monero";

const STANDARD =
  "4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRj5UzqtReoS44qo9mtmXCqY45DJ852K5Jv2684Rge";
// The well-known project donation address; decodes with the subaddress prefix (42).
const SUBADDRESS =
  "888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRxbANsAnjyPbb3iQ1YBRk1UXcdRsiKc9dhwMVgN5S9cQUiyoogDavup3H";

describe("monero address validation", () => {
  test("accepts a valid standard address (prefix 18, '4...')", () => {
    expect(monero.validate(STANDARD)).toBe(true);
  });

  test("accepts a valid subaddress (prefix 42, '8...')", () => {
    expect(monero.validate(SUBADDRESS)).toBe(true);
  });

  test("rejects wrong length, garbage and empty", () => {
    expect(monero.validate(STANDARD.slice(0, -1))).toBe(false);
    expect(monero.validate(`${STANDARD}x`)).toBe(false);
    expect(monero.validate("not-an-address")).toBe(false);
    expect(monero.validate("")).toBe(false);
  });

  test("rejects invalid base58 characters", () => {
    expect(monero.validate(`0${STANDARD.slice(1)}`)).toBe(false);
  });

  test("normalize is a no-op", () => {
    expect(monero.normalize(STANDARD)).toBe(STANDARD);
  });
});
