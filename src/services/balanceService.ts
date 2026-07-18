import { env } from "../config/env";
import { getDb } from "../db/client";
import { fetchAddressBalance } from "../ingest/esploraCommon";
import { fetchEvmBalances } from "../ingest/evmWatcher";
import { fetchBitcoinCashBalance } from "../ingest/bitcoinCashWatcher";
import { formatUnits } from "../ingest/format";
import { fetchViewOnlyReceived } from "../ingest/moneroWalletRpc";
import { fetchSolanaBalances } from "../ingest/solanaWatcher";
import { getPrice } from "../prices";
import type { AddressRow } from "../types";

const MONERO_DECIMALS = 12;

interface AssetBalance {
  asset: string;
  amount: string;
  fiatValue: number | null;
}

export interface WalletBalance {
  id: string;
  chain: string;
  address: string;
  label: string | null;
  /** True for chains where this reflects lifetime received, not a live spendable balance (Monero). */
  approximate: boolean;
  assets: AssetBalance[];
  fiatValue: number | null;
}

interface CacheEntry {
  assets: { asset: string; amount: string }[];
  fetchedAt: number;
}

const balanceCache = new Map<string, CacheEntry>();
const BALANCE_CACHE_MS = 20_000;

function priceAsset(
  asset: string,
  amount: string,
): { value: number | null; fetchedAt: number | null } {
  const quote = getPrice(asset);
  if (!quote) return { value: null, fetchedAt: null };
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return { value: null, fetchedAt: null };
  const value = n * quote.value;
  return Number.isFinite(value)
    ? { value: Math.round(value * 100) / 100, fetchedAt: quote.fetchedAt }
    : { value: null, fetchedAt: null };
}

async function fetchChainAssets(
  chain: string,
  address: string,
): Promise<{ asset: string; amount: string; approximate: boolean }[]> {
  switch (chain) {
    case "bitcoin": {
      const raw = await fetchAddressBalance(env.ingest.bitcoinEsploraUrl, address, "bitcoin");
      return raw === null
        ? []
        : [{ asset: "BTC", amount: formatUnits(raw, 8), approximate: false }];
    }
    case "litecoin": {
      const raw = await fetchAddressBalance(env.ingest.litecoinEsploraUrl, address, "litecoin");
      return raw === null
        ? []
        : [{ asset: "LTC", amount: formatUnits(raw, 8), approximate: false }];
    }
    case "bitcoin-cash": {
      const raw = await fetchBitcoinCashBalance(address);
      return raw === null
        ? []
        : [{ asset: "BCH", amount: formatUnits(raw, 8), approximate: false }];
    }
    case "ethereum": {
      const balances = await fetchEvmBalances(
        env.ingest.ethereumRpcUrl,
        "ETH",
        address,
        env.ingest.ethereumErc20Tokens,
      );
      return balances.map((b) => ({
        asset: b.asset,
        amount: formatUnits(b.raw, b.decimals),
        approximate: false,
      }));
    }
    case "base": {
      const balances = await fetchEvmBalances(
        env.ingest.baseRpcUrl,
        "ETH",
        address,
        env.ingest.baseErc20Tokens,
      );
      return balances.map((b) => ({
        asset: b.asset,
        amount: formatUnits(b.raw, b.decimals),
        approximate: false,
      }));
    }
    case "solana": {
      const balances = await fetchSolanaBalances(
        env.ingest.solanaRpcUrl,
        address,
        env.ingest.solanaSplTokens,
      );
      return balances.map((b) => ({
        asset: b.asset,
        amount: formatUnits(b.raw, b.decimals),
        approximate: false,
      }));
    }
    default:
      return [];
  }
}

async function fetchMoneroAssets(
  address: string,
  viewKey: string,
): Promise<{ asset: string; amount: string; approximate: boolean }[]> {
  const raw = await fetchViewOnlyReceived(address, viewKey);
  return [{ asset: "XMR", amount: formatUnits(raw, MONERO_DECIMALS), approximate: true }];
}

async function getAssetsFor(
  row: Pick<AddressRow, "chain" | "address" | "id">,
): Promise<{ assets: { asset: string; amount: string }[]; approximate: boolean }> {
  const cacheKey = `${row.chain}:${row.address}`;
  const cached = balanceCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < BALANCE_CACHE_MS) {
    return { assets: cached.assets, approximate: row.chain === "monero" };
  }

  let fetched: { asset: string; amount: string; approximate: boolean }[];
  if (row.chain === "monero") {
    const key = getDb()
      .query<{ view_key: string }, [string]>(
        "SELECT view_key FROM monero_watch_keys WHERE address_id = ?",
      )
      .get(row.id);
    if (!key) return { assets: [], approximate: true };
    try {
      fetched = await fetchMoneroAssets(row.address, key.view_key);
    } catch (err) {
      console.error(
        `[balances:monero] failed for ${row.address}: ${err instanceof Error ? err.message : err}`,
      );
      return { assets: [], approximate: true };
    }
  } else {
    try {
      fetched = await fetchChainAssets(row.chain, row.address);
    } catch (err) {
      console.error(
        `[balances:${row.chain}] failed for ${row.address}: ${err instanceof Error ? err.message : err}`,
      );
      return { assets: [], approximate: false };
    }
  }

  const assets = fetched.map(({ asset, amount }) => ({ asset, amount }));
  balanceCache.set(cacheKey, { assets, fetchedAt: Date.now() });
  return { assets, approximate: row.chain === "monero" };
}

export async function getWalletBalances(personalKeyId: string): Promise<{
  currency: string;
  priceAsOf: number | null;
  total: number;
  wallets: WalletBalance[];
}> {
  const addresses = getDb()
    .query<AddressRow, [string]>(
      "SELECT * FROM addresses WHERE personal_key_id = ? ORDER BY created_at",
    )
    .all(personalKeyId);

  let total = 0;
  let priceAsOf: number | null = null;

  const wallets = await Promise.all(
    addresses.map(async (row): Promise<WalletBalance> => {
      const { assets: rawAssets, approximate } = await getAssetsFor(row);

      let walletFiat: number | null = 0;
      const assets: AssetBalance[] = rawAssets
        .filter((a) => Number(a.amount) > 0)
        .map((a) => {
          const priced = priceAsset(a.asset, a.amount);
          if (priced.value === null) walletFiat = null;
          else if (walletFiat !== null) walletFiat += priced.value;
          if (priced.fetchedAt !== null) {
            priceAsOf =
              priceAsOf === null ? priced.fetchedAt : Math.min(priceAsOf, priced.fetchedAt);
          }
          return { asset: a.asset, amount: a.amount, fiatValue: priced.value };
        });

      if (walletFiat !== null) total += walletFiat;

      return {
        id: row.id,
        chain: row.chain,
        address: row.address,
        label: row.label,
        approximate,
        assets,
        fiatValue: walletFiat === null ? null : Math.round(walletFiat * 100) / 100,
      };
    }),
  );

  return {
    currency: env.prices.currency,
    priceAsOf: priceAsOf === null ? null : Math.floor(priceAsOf / 1000),
    total: Math.round(total * 100) / 100,
    wallets,
  };
}
