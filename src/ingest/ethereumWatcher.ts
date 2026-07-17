import { env, type Erc20Token } from "../config/env";
import type { NormalizedTx } from "../types";
import {
  createEvmPoller,
  parseEvmBlock,
  parseEvmTokenLogs,
  type EvmBlock,
  type EvmLog,
} from "./evmWatcher";

export function parseEthBlock(block: EvmBlock, watched: Set<string>): NormalizedTx[] {
  return parseEvmBlock(block, watched, "ETH");
}

export function parseErc20Logs(
  logs: EvmLog[],
  watched: Set<string>,
  tokens: Map<string, Erc20Token>,
  blockTimestamp: number,
): NormalizedTx[] {
  return parseEvmTokenLogs(logs, watched, tokens, blockTimestamp);
}

export const pollEthereum = createEvmPoller({
  chainId: "ethereum",
  nativeAsset: "ETH",
  get rpcUrl() {
    return env.ingest.ethereumRpcUrl;
  },
  get tokens() {
    return env.ingest.ethereumErc20Tokens;
  },
  get maxCatchupBlocks() {
    return env.ingest.ethereumMaxCatchupBlocks;
  },
});
