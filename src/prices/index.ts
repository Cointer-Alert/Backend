import { getEnabledChains } from "../chains";
import { env } from "../config/env";
import { fetchNativePrices, fetchTokenPrices } from "./coingecko";

export interface PriceQuote {
  value: number;
  currency: string;
  fetchedAt: number;
}

const cache = new Map<string, { value: number; fetchedAt: number }>();

const MAX_BACKOFF_MS = 5 * 60_000;

let stop: (() => void) | null = null;

export function getPrice(asset: string): PriceQuote | null {
  const entry = cache.get(asset.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > env.prices.stalenessMs) return null;
  return { value: entry.value, currency: env.prices.currency, fetchedAt: entry.fetchedAt };
}

export function formatFiat(value: number): string {
  const currency = env.prices.currency;
  const symbol = currency === "usd" ? "$" : "";
  const suffix = currency === "usd" ? "" : ` ${currency.toUpperCase()}`;
  if (value > 0 && value < 0.01) return `<${symbol}0.01${suffix}`;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}${suffix}`;
}

/** Chains whose tokens can be priced via CoinGecko's per-platform token_price endpoint. */
const TOKEN_PLATFORMS: { chainId: string; platformId: string }[] = [
  { chainId: "ethereum", platformId: "ethereum" },
  { chainId: "base", platformId: "base" },
  { chainId: "solana", platformId: "solana" },
];

function tokensForChain(chainId: string): { ticker: string; address: string }[] {
  switch (chainId) {
    case "ethereum":
      return env.ingest.ethereumErc20Tokens;
    case "base":
      return env.ingest.baseErc20Tokens;
    case "solana":
      return env.ingest.solanaSplTokens;
    default:
      return [];
  }
}

function targets(): {
  byId: { ticker: string; id: string }[];
  byAddress: { platformId: string; ticker: string; address: string }[];
} {
  const byId = new Map<string, string>();
  const byAddress: { platformId: string; ticker: string; address: string }[] = [];

  for (const chain of getEnabledChains()) {
    const ticker = chain.asset.toUpperCase();
    const id = env.prices.coinIds[ticker];
    if (id) byId.set(ticker, id);
  }
  for (const { chainId, platformId } of TOKEN_PLATFORMS) {
    if (!env.enabledChains.includes(chainId)) continue;
    for (const token of tokensForChain(chainId)) {
      const ticker = token.ticker.toUpperCase();
      const id = env.prices.coinIds[ticker];
      if (id) byId.set(ticker, id);
      else byAddress.push({ platformId, ticker, address: token.address });
    }
  }
  return { byId: [...byId].map(([ticker, id]) => ({ ticker, id })), byAddress };
}

async function refreshPrices(): Promise<void> {
  const { byId, byAddress } = targets();

  const addressesByPlatform = new Map<string, { ticker: string; address: string }[]>();
  for (const t of byAddress) {
    const list = addressesByPlatform.get(t.platformId) ?? [];
    list.push({ ticker: t.ticker, address: t.address });
    addressesByPlatform.set(t.platformId, list);
  }
  const platforms = [...addressesByPlatform.entries()];

  const results = await Promise.allSettled([
    fetchNativePrices(byId.map((t) => t.id)),
    ...platforms.map(([platformId, tokens]) =>
      fetchTokenPrices(
        platformId,
        tokens.map((t) => t.address),
      ),
    ),
  ]);

  const fetchedAt = Date.now();
  const [idRes, ...addressResults] = results;

  if (idRes!.status === "fulfilled") {
    for (const { ticker, id } of byId) {
      const value = idRes!.value[id];
      if (value !== undefined) cache.set(ticker, { value, fetchedAt });
    }
  }
  addressResults.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    const tokens = platforms[i]![1];
    for (const { ticker, address } of tokens) {
      const value = res.value[address];
      if (value !== undefined) cache.set(ticker, { value, fetchedAt });
    }
  });

  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) throw failed.reason;
}

export function startPriceFeed(): void {
  if (!env.prices.enabled) {
    console.log("[prices] feed disabled via PRICES_ENABLED=false");
    return;
  }
  const unmapped = getEnabledChains().filter((c) => !env.prices.coinIds[c.asset.toUpperCase()]);
  for (const chain of unmapped) {
    console.warn(
      `[prices] no CoinGecko id for ${chain.asset} — set PRICE_COINGECKO_IDS to price it`,
    );
  }

  let failures = 0;
  let timer: Timer | undefined;

  const schedule = (delayMs: number) => {
    timer = setTimeout(async () => {
      try {
        await refreshPrices();
        failures = 0;
        schedule(env.prices.refreshIntervalMs);
      } catch (err) {
        failures++;
        const delay = Math.min(env.prices.refreshIntervalMs * 2 ** failures, MAX_BACKOFF_MS);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[prices] refresh failed (attempt ${failures}, retry in ${Math.round(delay / 1000)}s): ${msg}`,
        );
        schedule(delay);
      }
    }, delayMs);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
  };

  stop = () => clearTimeout(timer);
  console.log(`[prices] feed started (every ${env.prices.refreshIntervalMs}ms)`);
  schedule(1000);
}

export function stopPriceFeed(): void {
  stop?.();
  stop = null;
}

export function __setPriceForTest(asset: string, value: number | null): void {
  if (value === null) cache.delete(asset.toUpperCase());
  else cache.set(asset.toUpperCase(), { value, fetchedAt: Date.now() });
}
