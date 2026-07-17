export interface SmtpEnv {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure: boolean;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid ${name}: expected a non-negative integer, got "${raw}"`);
  }
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

function url(name: string, fallback: string): string {
  return (process.env[name] ?? fallback).trim().replace(/\/+$/, "");
}

export interface Erc20Token {
  ticker: string;
  address: string;
  decimals: number;
}

const DEFAULT_ETHEREUM_ERC20_TOKENS: Erc20Token[] = [
  { ticker: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
  { ticker: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
  { ticker: "DAI", address: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18 },
];

const DEFAULT_BASE_ERC20_TOKENS: Erc20Token[] = [
  { ticker: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
  { ticker: "DAI", address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", decimals: 18 },
  { ticker: "EURC", address: "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42", decimals: 6 },
];

function loadEvmTokenList(envVarName: string, defaults: Erc20Token[]): Erc20Token[] {
  const raw = process.env[envVarName]?.trim();
  if (!raw) return defaults;
  return raw.split(",").map((entry) => {
    const [ticker, address, decimals] = entry.trim().split(":");
    const n = Number(decimals);
    if (
      !ticker ||
      !address ||
      !/^0x[0-9a-fA-F]{40}$/.test(address) ||
      !Number.isInteger(n) ||
      n < 0 ||
      n > 36
    ) {
      throw new Error(
        `Invalid ${envVarName} entry "${entry.trim()}", expected TICKER:0xaddress:decimals`,
      );
    }
    return { ticker, address: address.toLowerCase(), decimals: n };
  });
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

const DEFAULT_SOLANA_SPL_TOKENS: Erc20Token[] = [
  { ticker: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { ticker: "USDT", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
];

function loadSolanaTokenList(envVarName: string, defaults: Erc20Token[]): Erc20Token[] {
  const raw = process.env[envVarName]?.trim();
  if (!raw) return defaults;
  return raw.split(",").map((entry) => {
    const [ticker, mint, decimals] = entry.trim().split(":");
    const n = Number(decimals);
    if (
      !ticker ||
      !mint ||
      mint.length < 32 ||
      mint.length > 44 ||
      !BASE58_RE.test(mint) ||
      !Number.isInteger(n) ||
      n < 0 ||
      n > 36
    ) {
      throw new Error(
        `Invalid ${envVarName} entry "${entry.trim()}", expected TICKER:mintAddress:decimals`,
      );
    }
    return { ticker, address: mint, decimals: n };
  });
}

const DEFAULT_PRICE_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  SOL: "solana",
  XMR: "monero",
  EURC: "euro-coin",
};

function loadPriceIds(): Record<string, string> {
  const ids = { ...DEFAULT_PRICE_IDS };
  const raw = process.env.PRICE_COINGECKO_IDS?.trim();
  if (!raw) return ids;
  for (const entry of raw.split(",")) {
    const [ticker, id] = entry.trim().split(":");
    if (!ticker || !id || !/^[a-z0-9-]+$/.test(id)) {
      throw new Error(
        `Invalid PRICE_COINGECKO_IDS entry "${entry.trim()}", expected TICKER:coingecko-id`,
      );
    }
    ids[ticker.toUpperCase()] = id;
  }
  return ids;
}

export interface CloudflareEmailEnv {
  accountId: string;
  apiToken: string;
  /** Sender address. Its domain must be onboarded to Cloudflare Email Sending. */
  from: string;
}

/** Email over HTTPS via Cloudflare Email Service. Takes precedence over SMTP when set. */
function loadCloudflareEmail(): CloudflareEmailEnv | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  if (!accountId && !apiToken) return null;
  if (!accountId || !apiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN must both be set");
  }
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_FROM;
  if (!from)
    throw new Error("EMAIL_FROM (or SMTP_FROM) is required when Cloudflare email is configured");
  return { accountId, apiToken, from };
}

function loadAdminKeyHashes(): Set<string> {
  const raw = process.env.ADMIN_KEY_HASHES?.trim();
  if (!raw) return new Set();
  const hashes = raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  for (const hash of hashes) {
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error(
        `Invalid ADMIN_KEY_HASHES entry "${hash}", expected a 64-char SHA-256 hex hash (see scripts/hash-key.ts)`,
      );
    }
  }
  return new Set(hashes);
}

function loadSmtp(): SmtpEnv | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_HOST is set but SMTP_FROM is missing");
  return {
    host,
    port: int("SMTP_PORT", 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from,
    secure: bool("SMTP_SECURE", false),
  };
}

export const env = {
  port: int("PORT", 3000),
  databasePath: process.env.DATABASE_PATH ?? "./data/cointer.db",
  corsOrigins: (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  trustProxy: bool("TRUST_PROXY", false),
  trustProxyHeader: (process.env.TRUST_PROXY_HEADER ?? "x-forwarded-for").toLowerCase(),

  enabledChains: (process.env.ENABLED_CHAINS ?? "bitcoin")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean),

  smtp: loadSmtp(),
  cloudflareEmail: loadCloudflareEmail(),

  ingest: {
    watchersEnabled: bool("WATCHERS_ENABLED", true),
    bitcoinEsploraUrl: url("BITCOIN_ESPLORA_URL", "https://mempool.space/api"),
    bitcoinPollIntervalMs: int("BITCOIN_POLL_INTERVAL_MS", 30_000),
    bitcoinAddressGapMs: int("BITCOIN_ADDRESS_GAP_MS", 250),
    ethereumRpcUrl: url("ETHEREUM_RPC_URL", "https://ethereum-rpc.publicnode.com"),
    ethereumPollIntervalMs: int("ETHEREUM_POLL_INTERVAL_MS", 15_000),
    ethereumMaxCatchupBlocks: int("ETHEREUM_MAX_CATCHUP_BLOCKS", 50),
    ethereumErc20Tokens: loadEvmTokenList("ETHEREUM_ERC20_TOKENS", DEFAULT_ETHEREUM_ERC20_TOKENS),
    litecoinEsploraUrl: url("LITECOIN_ESPLORA_URL", "https://litecoinspace.org/api"),
    litecoinPollIntervalMs: int("LITECOIN_POLL_INTERVAL_MS", 30_000),
    litecoinAddressGapMs: int("LITECOIN_ADDRESS_GAP_MS", 250),
    baseRpcUrl: url("BASE_RPC_URL", "https://base-rpc.publicnode.com"),
    basePollIntervalMs: int("BASE_POLL_INTERVAL_MS", 5_000),
    baseMaxCatchupBlocks: int("BASE_MAX_CATCHUP_BLOCKS", 300),
    baseErc20Tokens: loadEvmTokenList("BASE_ERC20_TOKENS", DEFAULT_BASE_ERC20_TOKENS),
    solanaRpcUrl: url("SOLANA_RPC_URL", "https://solana-rpc.publicnode.com"),
    solanaPollIntervalMs: int("SOLANA_POLL_INTERVAL_MS", 10_000),
    solanaAddressGapMs: int("SOLANA_ADDRESS_GAP_MS", 250),
    solanaSignaturesPerPoll: int("SOLANA_SIGNATURES_PER_POLL", 100),
    solanaSplTokens: loadSolanaTokenList("SOLANA_SPL_TOKENS", DEFAULT_SOLANA_SPL_TOKENS),
    bitcoinCashExplorerUrl: url(
      "BITCOIN_CASH_EXPLORER_URL",
      "https://api.blockchair.com/bitcoin-cash",
    ),
    bitcoinCashExplorerApiKey: process.env.BITCOIN_CASH_EXPLORER_API_KEY,
    bitcoinCashPollIntervalMs: int("BITCOIN_CASH_POLL_INTERVAL_MS", 120_000),
    bitcoinCashAddressGapMs: int("BITCOIN_CASH_ADDRESS_GAP_MS", 2_000),
    moneroWalletRpcPath: process.env.MONERO_WALLET_RPC_PATH ?? "monero-wallet-rpc",
    // No hardcoded default: public remote nodes churn and go offline, and
    // shipping specific hostnames here risks silently pointing at dead or
    // untrustworthy infra. Operators must pick current nodes themselves,
    // e.g. from https://monero.fail or https://xmr.ditatompel.com/remote-nodes.
    moneroRemoteNodes: (process.env.MONERO_REMOTE_NODES ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean),
    moneroPollIntervalMs: int("MONERO_POLL_INTERVAL_MS", 60_000),
    maxAgeDays: int("INGEST_MAX_AGE_DAYS", 7),
  },

  prices: {
    enabled: bool("PRICES_ENABLED", true),
    baseUrl: url("COINGECKO_BASE_URL", "https://api.coingecko.com/api/v3"),
    apiKey: process.env.COINGECKO_API_KEY,
    refreshIntervalMs: int("PRICE_REFRESH_INTERVAL_MS", 60_000),
    stalenessMs: int("PRICE_STALENESS_MS", 15 * 60_000),
    currency: (process.env.PRICE_CURRENCY ?? "usd").toLowerCase(),
    coinIds: loadPriceIds(),
  },

  limits: {
    maxAddressesPerKey: int("MAX_ADDRESSES_PER_KEY", 10),
    maxChannelsPerKey: int("MAX_CHANNELS_PER_KEY", 10),
    maxPushTokensPerKey: int("MAX_PUSH_TOKENS_PER_KEY", 10),
    activityRetentionDays: int("ACTIVITY_RETENTION_DAYS", 90),
  },

  adminKeyHashes: loadAdminKeyHashes(),
};

if (env.limits.activityRetentionDays <= env.ingest.maxAgeDays) {
  throw new Error(
    `ACTIVITY_RETENTION_DAYS (${env.limits.activityRetentionDays}) must be greater than INGEST_MAX_AGE_DAYS (${env.ingest.maxAgeDays})`,
  );
}
