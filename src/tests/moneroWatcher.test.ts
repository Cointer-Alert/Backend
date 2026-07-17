import { describe, expect, test } from "bun:test";
import { parseMoneroTransfers } from "../ingest/moneroWatcher";

const ADDR = "monero-test-address";

describe("parseMoneroTransfers", () => {
  test("converts atomic units to XMR with 12 decimals", () => {
    const txs = parseMoneroTransfers(
      ADDR,
      [
        {
          txid: "aa",
          amount: 1_000_000_000_000,
          height: 100,
          timestamp: 1_700_000_000,
          type: "in",
        },
      ],
      new Set(),
    );
    expect(txs).toHaveLength(1);
    expect(txs[0]!.amount).toBe("1");
    expect(txs[0]!.asset).toBe("XMR");
    expect(txs[0]!.timestamp).toBe(1_700_000_000);
  });

  test("skips already-seen txids", () => {
    const txs = parseMoneroTransfers(
      ADDR,
      [{ txid: "aa", amount: 500_000_000_000, height: 100, timestamp: 0, type: "in" }],
      new Set(["aa"]),
    );
    expect(txs).toHaveLength(0);
  });

  test("skips zero and negative amounts", () => {
    const txs = parseMoneroTransfers(
      ADDR,
      [{ txid: "bb", amount: 0, height: 100, timestamp: 0, type: "in" }],
      new Set(),
    );
    expect(txs).toHaveLength(0);
  });

  test("ignores outgoing/pending/failed transfer types", () => {
    const txs = parseMoneroTransfers(
      ADDR,
      [
        { txid: "cc", amount: 1000, height: 100, timestamp: 0, type: "out" },
        { txid: "dd", amount: 1000, height: 0, timestamp: 0, type: "failed" },
      ],
      new Set(),
    );
    expect(txs).toHaveLength(0);
  });

  test("pool (unconfirmed) transfers carry no timestamp", () => {
    const txs = parseMoneroTransfers(
      ADDR,
      [{ txid: "ee", amount: 1000, height: 0, timestamp: 1_700_000_000, type: "pool" }],
      new Set(),
    );
    expect(txs[0]!.timestamp).toBeUndefined();
  });
});
