import { getChain } from "../chains";
import { recordActivity } from "../services/activityService";
import { listMoneroWatchTargets } from "../services/addressService";
import { processIncomingTxs } from "../services/ingestService";
import type { NormalizedTx } from "../types";
import { getAddressCursor, setAddressCursor } from "./addressState";
import {
  ensureWalletRpcRunning,
  fetchIncomingTransfers,
  type MoneroTransfer,
} from "./moneroWalletRpc";
import { formatUnits } from "./format";

const ATOMIC_UNIT_DECIMALS = 12;

export function parseMoneroTransfers(
  address: string,
  transfers: MoneroTransfer[],
  seenTxids: Set<string>,
): NormalizedTx[] {
  const out: NormalizedTx[] = [];
  for (const t of transfers) {
    if (t.type !== "in" && t.type !== "pool") continue;
    if (seenTxids.has(t.txid) || t.amount <= 0) continue;
    out.push({
      txHash: t.txid,
      address,
      amount: formatUnits(BigInt(t.amount), ATOMIC_UNIT_DECIMALS),
      asset: "XMR",
      timestamp: t.type === "pool" ? undefined : t.timestamp,
    });
  }
  return out;
}

async function processAddress(
  chainId: string,
  address: string,
  viewKey: string,
  onTxs: (txs: NormalizedTx[]) => Promise<void>,
): Promise<void> {
  const seenRaw = getAddressCursor(chainId, address);
  const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);

  const transfers = await fetchIncomingTransfers(address, viewKey);
  const txs = parseMoneroTransfers(address, transfers, seen);
  if (txs.length > 0) await onTxs(txs);

  // Mark every emitted tx (pool or confirmed) as seen immediately, so a
  // mempool transfer notified once doesn't notify again after it confirms.
  for (const tx of txs) seen.add(tx.txHash);
  const capped = [...seen].slice(-500);
  setAddressCursor(chainId, address, JSON.stringify(capped));
}

export async function seedMoneroAddress(
  personalKeyId: string,
  address: string,
  viewKey: string,
): Promise<void> {
  await ensureWalletRpcRunning();
  await processAddress("monero", address, viewKey, async (txs) => {
    for (const tx of txs) {
      recordActivity(personalKeyId, "monero", tx.address, tx.txHash, tx.amount, tx.asset);
    }
  });
}

export async function pollMonero(): Promise<void> {
  const chain = getChain("monero");
  if (!chain) return;

  const targets = listMoneroWatchTargets();
  if (targets.length === 0) return;

  await ensureWalletRpcRunning();
  for (const { address, viewKey } of targets) {
    await processAddress(chain.id, address, viewKey, (txs) => processIncomingTxs(chain, txs));
  }
}
