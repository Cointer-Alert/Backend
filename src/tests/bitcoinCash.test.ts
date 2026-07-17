import { describe, expect, test } from "bun:test";
import { bitcoinCash } from "../chains/bitcoinCash";
import { parseBlockchairTxs } from "../ingest/bitcoinCashWatcher";

describe("bitcoin cash address validation", () => {
  test("accepts a valid CashAddr with prefix (official spec test vector)", () => {
    expect(bitcoinCash.validate("bitcoincash:qr6m7j9njldwwzlg9v7v53unlr4jkmx6eylep8ekg2")).toBe(
      true,
    );
  });

  test("accepts a valid CashAddr without prefix", () => {
    expect(bitcoinCash.validate("qr6m7j9njldwwzlg9v7v53unlr4jkmx6eylep8ekg2")).toBe(true);
  });

  test("accepts a valid legacy P2PKH address (shared format with Bitcoin)", () => {
    expect(bitcoinCash.validate("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
  });

  test("rejects a tampered CashAddr checksum", () => {
    expect(bitcoinCash.validate("bitcoincash:qr6m7j9njldwwzlg9v7v53unlr4jkmx6eylep8ekg3")).toBe(
      false,
    );
  });

  test("rejects bad legacy base58 checksum, garbage and empty", () => {
    expect(bitcoinCash.validate("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb")).toBe(false);
    expect(bitcoinCash.validate("not-an-address")).toBe(false);
    expect(bitcoinCash.validate("")).toBe(false);
  });

  test("normalizes legacy to CashAddr encoding the same hash160", () => {
    expect(bitcoinCash.normalize("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(
      "bitcoincash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy",
    );
  });

  test("normalizes bare CashAddr to prefixed form", () => {
    expect(bitcoinCash.normalize("qr6m7j9njldwwzlg9v7v53unlr4jkmx6eylep8ekg2")).toBe(
      "bitcoincash:qr6m7j9njldwwzlg9v7v53unlr4jkmx6eylep8ekg2",
    );
  });
});

describe("parseBlockchairTxs", () => {
  const ADDR = "bitcoincash:qr6m7j9njldwwzlg9v7v53unlr4jkmx6eylep8ekg2";

  test("keeps only positive balance_change entries", () => {
    const txs = parseBlockchairTxs(ADDR, [
      {
        block_id: 700_000,
        transaction_hash: "aa",
        time: "2024-01-01 00:00:00",
        balance_change: 50_000,
      },
      {
        block_id: 700_001,
        transaction_hash: "bb",
        time: "2024-01-01 00:01:00",
        balance_change: -20_000,
      },
    ]);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.txHash).toBe("aa");
    expect(txs[0]!.amount).toBe("0.0005");
    expect(txs[0]!.asset).toBe("BCH");
  });

  test("mempool entries (block_id -1) carry no timestamp", () => {
    const txs = parseBlockchairTxs(ADDR, [
      { block_id: -1, transaction_hash: "cc", time: "2024-01-01 00:00:00", balance_change: 1000 },
    ]);
    expect(txs[0]!.timestamp).toBeUndefined();
  });

  test("confirmed entries carry a unix timestamp", () => {
    const txs = parseBlockchairTxs(ADDR, [
      {
        block_id: 700_000,
        transaction_hash: "dd",
        time: "2024-01-01 00:00:00",
        balance_change: 1000,
      },
    ]);
    expect(txs[0]!.timestamp).toBe(Math.floor(new Date("2024-01-01 00:00:00Z").getTime() / 1000));
  });
});
