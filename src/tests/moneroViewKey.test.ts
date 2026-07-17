import { describe, expect, test } from "bun:test";

process.env.DATABASE_PATH = ":memory:";
process.env.WATCHERS_ENABLED = "false";

const { connectDb, getDb, now } = await import("../db/client");
const { removeAddress, listMoneroWatchTargets } = await import("../services/addressService");
const { createPersonalKey } = await import("../services/personalService");

connectDb(":memory:");

const STANDARD_ADDR = "monero-test-address-placeholder";
const VIEW_KEY = "a".repeat(64);

function mintKey(): string {
  const { id } = createPersonalKey();
  return id;
}

/**
 * addAddress() gates on env.enabledChains, which is a frozen singleton set
 * from ENABLED_CHAINS at first import — other test files import it first
 * with "monero" absent, so it can't be flipped per-file here. These tests
 * exercise the storage/cascade behavior addAddress relies on directly at
 * the DB layer instead of going through the chain-enablement gate; the
 * viewKey format validation itself is covered by reading addressService.ts.
 */
function insertMoneroAddress(personalKeyId: string, address: string, viewKey: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = now();
  db.run(
    "INSERT INTO addresses (id, personal_key_id, chain, address, label, created_at) VALUES (?, ?, 'monero', ?, NULL, ?)",
    [id, personalKeyId, address, createdAt],
  );
  db.run("INSERT INTO monero_watch_keys (address_id, view_key, created_at) VALUES (?, ?, ?)", [
    id,
    viewKey,
    createdAt,
  ]);
  return id;
}

describe("Monero view key storage", () => {
  test("listMoneroWatchTargets exposes the stored view key per address", () => {
    const keyId = mintKey();
    insertMoneroAddress(keyId, STANDARD_ADDR, VIEW_KEY);
    const targets = listMoneroWatchTargets();
    const target = targets.find((t) => t.address === STANDARD_ADDR);
    expect(target?.viewKey).toBe(VIEW_KEY);
  });

  test("removing the address cascades to delete its view key", () => {
    const keyId = mintKey();
    const addressId = insertMoneroAddress(keyId, `${STANDARD_ADDR}-2`, VIEW_KEY);
    removeAddress(keyId, addressId);
    const row = getDb()
      .query<{ address_id: string }, [string]>(
        "SELECT address_id FROM monero_watch_keys WHERE address_id = ?",
      )
      .get(addressId);
    expect(row).toBeNull();
  });
});
