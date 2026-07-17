import { getChain } from "../chains";
import { env } from "../config/env";
import { recordActivity } from "../services/activityService";
import { listAllWatchedAddresses } from "../services/addressService";
import { processIncomingTxs } from "../services/ingestService";
import { fetchAddressTxs, parseEsploraTxs, sleep } from "./esploraCommon";

export async function seedLitecoinAddress(personalKeyId: string, address: string): Promise<void> {
  const txs = await fetchAddressTxs(env.ingest.litecoinEsploraUrl, address, "litecoin");
  if (!txs) return;
  for (const tx of parseEsploraTxs(address, txs, "LTC", 8)) {
    recordActivity(personalKeyId, "litecoin", tx.address, tx.txHash, tx.amount, tx.asset);
  }
}

export async function pollLitecoin(): Promise<void> {
  const chain = getChain("litecoin");
  if (!chain) return;

  const addresses = listAllWatchedAddresses(chain.id);
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]!;
    if (i > 0) await sleep(env.ingest.litecoinAddressGapMs);

    const txs = await fetchAddressTxs(env.ingest.litecoinEsploraUrl, address, "litecoin");
    if (!txs) continue;
    await processIncomingTxs(chain, parseEsploraTxs(address, txs, "LTC", 8));
  }
}
