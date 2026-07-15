import { afterAll, describe, expect, test } from "bun:test";

process.env.DATABASE_PATH = ":memory:";
process.env.WATCHERS_ENABLED = "false";

const { env } = await import("../config/env");
const { connectDb, getDb, now } = await import("../db/client");
const { buildApp } = await import("../server");
const { hashPersonalKey } = await import("../middleware/auth");
const { pruneOldActivity, recordActivity } = await import("../services/activityService");
const { createPersonalKey } = await import("../services/personalService");
const { addAddress } = await import("../services/addressService");
const { addChannel } = await import("../services/channelService");
const { registerPushToken, ValidationError } = await import("../services/pushTokenService");

connectDb(":memory:");
const app = buildApp();

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const BTC_ADDRESSES = [
  "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
  "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
  "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
  "1JfbZRwdDHKZmuiZgYArJZhcuuzuw2HuMu",
  "1Ez69SnzzmePmZX3WpEzMKTrcBF2gpNQ55",
  "12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX",
  "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1",
  "1FvzCLoTPGANNjWoUo6jUGuAG3wg1w4YjR",
  "1CounterpartyXXXXXXXXXXXXXXXUWLpVr",
];

describe("admin keys", () => {
  const adminHashes: string[] = [];
  const mintedIds: string[] = [];
  afterAll(() => {
    for (const h of adminHashes) env.adminKeyHashes.delete(h);
    for (const id of mintedIds) getDb().run("DELETE FROM personal_keys WHERE id = ?", [id]);
  });

  function mintKey() {
    const { id, personalKey } = createPersonalKey();
    mintedIds.push(id);
    return { id, key: personalKey, auth: { Authorization: `Bearer ${personalKey}` } };
  }

  function mintAdmin() {
    const minted = mintKey();
    const hash = hashPersonalKey(minted.key);
    env.adminKeyHashes.add(hash);
    adminHashes.push(hash);
    return minted;
  }

  test("GET /personal reports isAdmin and null limits for an admin key", async () => {
    const admin = mintAdmin();
    const res = await app.fetch(req("/personal", { headers: admin.auth }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { isAdmin: boolean; limits: Record<string, number | null> };
    expect(body.isAdmin).toBe(true);
    expect(body.limits).toEqual({
      maxAddresses: null,
      maxChannels: null,
      maxPushTokens: null,
      activityRetentionDays: null,
    });
  });

  test("GET /personal reports isAdmin false and numeric limits for a normal key", async () => {
    const normal = mintKey();
    const res = await app.fetch(req("/personal", { headers: normal.auth }));
    const body = (await res.json()) as { isAdmin: boolean; limits: Record<string, number | null> };
    expect(body.isAdmin).toBe(false);
    expect(body.limits).toEqual({
      maxAddresses: 10,
      maxChannels: 10,
      maxPushTokens: 10,
      activityRetentionDays: 90,
    });
  });

  test("admin bypasses the address limit, normal key does not", () => {
    const admin = mintKey();
    const normal = mintKey();
    for (const [i, address] of BTC_ADDRESSES.entries()) {
      expect(() => addAddress(admin.id, "bitcoin", address, undefined, true)).not.toThrow();
      if (i < 10) {
        expect(() => addAddress(normal.id, "bitcoin", address, undefined, false)).not.toThrow();
      } else {
        expect(() => addAddress(normal.id, "bitcoin", address, undefined, false)).toThrow(
          new ValidationError("Address limit reached (10)"),
        );
      }
    }
  });

  test("admin bypasses the channel limit, normal key does not", () => {
    const admin = mintKey();
    const normal = mintKey();
    for (let i = 0; i < 11; i++) {
      const config = { topic: `cointer-test-${i}` };
      expect(() => addChannel(admin.id, "ntfy", config, true)).not.toThrow();
      if (i < 10) {
        expect(() => addChannel(normal.id, "ntfy", config, false)).not.toThrow();
      } else {
        expect(() => addChannel(normal.id, "ntfy", config, false)).toThrow(
          new ValidationError("Channel limit reached (10)"),
        );
      }
    }
  });

  test("admin bypasses the push token limit, normal key does not", () => {
    const admin = mintKey();
    const normal = mintKey();
    for (let i = 0; i < 11; i++) {
      const token = `ExponentPushToken[padpadpad${String(i).padStart(2, "0")}]`;
      expect(() => registerPushToken(admin.id, token, "ios", true)).not.toThrow();
      if (i < 10) {
        expect(() => registerPushToken(normal.id, token, "ios", false)).not.toThrow();
      } else {
        expect(() => registerPushToken(normal.id, token, "ios", false)).toThrow(
          new ValidationError("Push token limit reached (10)"),
        );
      }
    }
  });

  test("pruneOldActivity keeps admin rows and deletes normal rows past retention", () => {
    const admin = mintAdmin();
    const normal = mintKey();

    const oldTs = now() - (env.limits.activityRetentionDays + 5) * 86_400;
    recordActivity(admin.id, "bitcoin", "addr-a", "tx-admin-old", "1", "BTC");
    recordActivity(normal.id, "bitcoin", "addr-n", "tx-normal-old", "1", "BTC");
    recordActivity(normal.id, "bitcoin", "addr-n", "tx-normal-fresh", "1", "BTC");
    getDb().run("UPDATE activity SET created_at = ? WHERE tx_hash IN (?, ?)", [
      oldTs,
      "tx-admin-old",
      "tx-normal-old",
    ]);

    pruneOldActivity();

    const remaining = getDb()
      .query<{ tx_hash: string }, []>("SELECT tx_hash FROM activity ORDER BY tx_hash")
      .all()
      .map((r) => r.tx_hash);
    expect(remaining).toContain("tx-admin-old");
    expect(remaining).toContain("tx-normal-fresh");
    expect(remaining).not.toContain("tx-normal-old");
  });
});
