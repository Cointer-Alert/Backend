import { getChain } from "../chains";
import { env } from "../config/env";
import { recordActivity } from "../services/activityService";
import { listAllWatchedAddresses } from "../services/addressService";
import { processIncomingTxs } from "../services/ingestService";
import { fetchAddressTxs, parseEsploraTxs, sleep } from "./esploraCommon";

export async function seedBitcoinAddress(personalKeyId: string, address: string): Promise<void> {
  const txs = await fetchAddressTxs(env.ingest.bitcoinEsploraUrl, address, "bitcoin");
  if (!txs) return;
  for (const tx of parseEsploraTxs(address, txs, "BTC", 8)) {
    recordActivity(personalKeyId, "bitcoin", tx.address, tx.txHash, tx.amount, tx.asset);
  }
}

export async function pollBitcoin(): Promise<void> {
  const chain = getChain("bitcoin");
  if (!chain) return;

  const addresses = listAllWatchedAddresses(chain.id);
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]!;
    if (i > 0) await sleep(env.ingest.bitcoinAddressGapMs);

    const txs = await fetchAddressTxs(env.ingest.bitcoinEsploraUrl, address, "bitcoin");
    if (!txs) continue;
    await processIncomingTxs(chain, parseEsploraTxs(address, txs, "BTC", 8));
  }
}
