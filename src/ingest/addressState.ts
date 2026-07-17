import { getDb, now } from "../db/client";

export function getAddressCursor(chain: string, address: string): string | null {
  const row = getDb()
    .query<{ cursor: string }, [string, string]>(
      "SELECT cursor FROM ingest_address_state WHERE chain = ? AND address = ?",
    )
    .get(chain, address);
  return row ? row.cursor : null;
}

export function setAddressCursor(chain: string, address: string, cursor: string): void {
  getDb().run(
    `INSERT INTO ingest_address_state (chain, address, cursor, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (chain, address) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
    [chain, address, cursor, now()],
  );
}
