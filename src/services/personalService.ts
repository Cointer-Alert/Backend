import { env } from "../config/env";
import { getDb, now } from "../db/client";
import { hashPersonalKey } from "../middleware/auth";
import { listMutesForKey } from "./addressNotificationService";
import { listAddresses } from "./addressService";
import { listChannels } from "./channelService";
import { listPushTokens } from "./pushTokenService";

export function generatePersonalKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "ck_" + Buffer.from(bytes).toString("base64url");
}

export function createPersonalKey(): { id: string; personalKey: string } {
  const personalKey = generatePersonalKey();
  const id = crypto.randomUUID();
  const ts = now();
  getDb().run(
    "INSERT INTO personal_keys (id, key_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)",
    [id, hashPersonalKey(personalKey), ts, ts],
  );
  return { id, personalKey };
}

export function getPersonalConfig(personalKeyId: string, isAdmin = false) {
  const row = getDb()
    .query<{ created_at: number }, [string]>("SELECT created_at FROM personal_keys WHERE id = ?")
    .get(personalKeyId);
  const mutes = listMutesForKey(personalKeyId);
  return {
    createdAt: row?.created_at ?? null,
    isAdmin,
    limits: {
      maxAddresses: isAdmin ? null : env.limits.maxAddressesPerKey,
      maxChannels: isAdmin ? null : env.limits.maxChannelsPerKey,
      maxPushTokens: isAdmin ? null : env.limits.maxPushTokensPerKey,
      activityRetentionDays: isAdmin ? null : env.limits.activityRetentionDays,
    },
    addresses: listAddresses(personalKeyId).map((a) => ({
      ...a,
      notifications: mutes.get(a.id) ?? { pushMuted: false, mutedChannelIds: [] },
    })),
    channels: listChannels(personalKeyId),
    pushTokens: listPushTokens(personalKeyId),
  };
}

export function rotatePersonalKey(personalKeyId: string): string {
  const personalKey = generatePersonalKey();
  getDb().run("UPDATE personal_keys SET key_hash = ? WHERE id = ?", [
    hashPersonalKey(personalKey),
    personalKeyId,
  ]);
  return personalKey;
}

export function deletePersonalKey(personalKeyId: string): void {
  getDb().run("DELETE FROM personal_keys WHERE id = ?", [personalKeyId]);
}
