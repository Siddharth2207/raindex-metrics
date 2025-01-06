export interface Variables {
    skip: number;
    first: number;
}
export interface Token {
    id: string;
    address: string;
    name: string;
    symbol: string;
    decimals: string;
}
export interface InputOutput {
    token: Token;
    balance: string;
    vaultId: string;
    id: string;
}

export interface Order {
    orderHash: string;
    owner: string;
    outputs: InputOutput[];
    inputs: InputOutput[];
    orderbook: { id: string };
    active: boolean;
    timestampAdded: string;
    trades: {
        id: string;
        inputVaultBalanceChange: {
            newVaultBalance: string;
            amount: string;
            oldVaultBalance: string;
        };
        outputVaultBalanceChange: {
            amount: string;
            newVaultBalance: string;
            oldVaultBalance: string;
        };
        timestamp: string;
    }[];
}
export interface TokenConfig {
    symbol: string;
    decimals: number;
    network: string;
    address: string;
    poolsV2: string[];
    poolsV3: string[];
    poolsPancakSwapV3: string[];
}

export interface StablesConfig {
    symbol: string;
    decimals: number;
    address: string;
}

export interface NetworkConfig {
    chainId: number;
    blockTime: number;
    rpc: string;
    subgraphUrl: string;
    stables: StablesConfig[];
}

export type Config = Record<string, TokenConfig>;

export type NetworkConfigurations = Record<string, NetworkConfig>;

export interface LiquidityPool {
    volume24h: number;
    trades24h: number;
    pairAddress: string;
    dex: string;
    poolSizeUsd: number;
    poolBaseTokenLiquidity: string;
    poolQuoteTokenLiquidity: string;
    h24Buys: number;
    h24Sells: number;
    priceChange24h: number;
}

export interface AggregatedLiquidityData {
    dex: string;
    pairAddress: string;
    totalPoolVolume: string;
    totalPoolTrades: number;
    totalPoolSizeUsd: number;
    baseTokenLiquidity: string;
    quoteTokenLiquidity: string;
}

export interface LiquidityAnalysisResult {
    totalPoolVolume: number;
    totalPoolTrades: number;
    liquidityDataAggregated: AggregatedLiquidityData[];
}

export interface TokenPair {
    baseToken: {
        address: string;
    };
    quoteToken: {
        address: string;
    };
    priceNative: string;
    priceUsd: string;
    priceChange: {
        h24: string;
    };
}

export interface TokenPrice {
    averagePrice: number;
    currentPrice: number;
}
