import { env } from "../config/env";
import { createEvmPoller } from "./evmWatcher";

export const pollBase = createEvmPoller({
  chainId: "base",
  nativeAsset: "ETH",
  get rpcUrl() {
    return env.ingest.baseRpcUrl;
  },
  get tokens() {
    return env.ingest.baseErc20Tokens;
  },
  get maxCatchupBlocks() {
    return env.ingest.baseMaxCatchupBlocks;
  },
});
