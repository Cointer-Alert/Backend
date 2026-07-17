import { env } from "../config/env";
import { pollBase } from "./baseWatcher";
import { pollBitcoin, seedBitcoinAddress } from "./bitcoinWatcher";
import { pollBitcoinCash, seedBitcoinCashAddress } from "./bitcoinCashWatcher";
import { pollEthereum } from "./ethereumWatcher";
import { pollLitecoin, seedLitecoinAddress } from "./litecoinWatcher";
import { pollMonero, seedMoneroAddress } from "./moneroWatcher";
import { stopWalletRpc } from "./moneroWalletRpc";
import { pollSolana, seedSolanaAddress } from "./solanaWatcher";

interface Watcher {
  chainId: string;
  intervalMs: number;
  poll(): Promise<void>;
}

const watchers: Record<string, Omit<Watcher, "chainId">> = {
  bitcoin: { intervalMs: env.ingest.bitcoinPollIntervalMs, poll: pollBitcoin },
  ethereum: { intervalMs: env.ingest.ethereumPollIntervalMs, poll: pollEthereum },
  litecoin: { intervalMs: env.ingest.litecoinPollIntervalMs, poll: pollLitecoin },
  base: { intervalMs: env.ingest.basePollIntervalMs, poll: pollBase },
  solana: { intervalMs: env.ingest.solanaPollIntervalMs, poll: pollSolana },
  "bitcoin-cash": {
    intervalMs: env.ingest.bitcoinCashPollIntervalMs,
    poll: pollBitcoinCash,
  },
  monero: { intervalMs: env.ingest.moneroPollIntervalMs, poll: pollMonero },
};

const MAX_BACKOFF_MS = 5 * 60_000;

let stops: (() => void)[] = [];

function runLoop(watcher: Watcher): void {
  let failures = 0;
  let timer: Timer | undefined;

  const schedule = (delayMs: number) => {
    timer = setTimeout(async () => {
      try {
        await watcher.poll();
        failures = 0;
        schedule(watcher.intervalMs);
      } catch (err) {
        failures++;
        const delay = Math.min(watcher.intervalMs * 2 ** failures, MAX_BACKOFF_MS);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[ingest:${watcher.chainId}] poll failed (attempt ${failures}, retry in ${Math.round(delay / 1000)}s): ${msg}`,
        );
        schedule(delay);
      }
    }, delayMs);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
  };

  stops.push(() => clearTimeout(timer));
  schedule(1000);
}

export function startWatchers(): void {
  if (!env.ingest.watchersEnabled) {
    console.log("[ingest] watchers disabled via WATCHERS_ENABLED=false");
    return;
  }
  for (const chainId of env.enabledChains) {
    const watcher = watchers[chainId];
    if (!watcher) {
      console.warn(
        `[ingest] chain "${chainId}" is enabled but has no watcher — addresses on it will never notify`,
      );
      continue;
    }
    console.log(`[ingest:${chainId}] watcher started (every ${watcher.intervalMs}ms)`);
    runLoop({ chainId, ...watcher });
  }
}

export function stopWatchers(): void {
  for (const stop of stops) stop();
  stops = [];
  stopWalletRpc();
}

export async function seedAddressHistory(
  chainId: string,
  personalKeyId: string,
  address: string,
  moneroViewKey?: string,
): Promise<void> {
  if (!env.ingest.watchersEnabled) return;
  try {
    if (chainId === "bitcoin") await seedBitcoinAddress(personalKeyId, address);
    if (chainId === "litecoin") await seedLitecoinAddress(personalKeyId, address);
    if (chainId === "solana") await seedSolanaAddress(personalKeyId, address);
    if (chainId === "bitcoin-cash") await seedBitcoinCashAddress(personalKeyId, address);
    if (chainId === "monero" && moneroViewKey) {
      await seedMoneroAddress(personalKeyId, address, moneroViewKey);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ingest:${chainId}] history seed failed for ${address}: ${msg}`);
  }
}
