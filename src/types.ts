
// Define variables type
export interface Variables {
    skip: number;
    first: number;
}

// Define token structure
export interface Token {
    id: string;
    address: string;
    name: string;
    symbol: string;
    decimals: string;
}

// Define inputs and outputs structure
export interface InputOutput {
    token: Token;
    balance: string;
    vaultId: string;
    id: string
}

// Define the response structure
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

// Define the type for a token configuration
export interface TokenConfig {
    symbol: string;
    decimals: number;
    network: string;
    address: string;
  }

export interface StablesConfig {
    symbol: string;
    decimals: number;
    address: string;
  }

export interface NetworkConfig {
chainId: number;
rpc: string;
subgraphUrl: string;
stables: StablesConfig[];
}

// Define the type for the config object
export type Config = Record<string, TokenConfig>;

// Define the type for the networkConfig object
export type NetworkConfigurations = Record<string, NetworkConfig>;

// Define the LiquidityPool type to represent individual pool data
export interface LiquidityPool {
    volume24h: number;
    trades24h: number;
    pairAddress: string;
    dex: string;
    poolSizeUsd: number;
    poolBaseTokenLiquidity: string;
    poolQuoteTokenLiquidity: string;
}

// Define the AggregatedLiquidityData type for processed liquidity data
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
  
export  interface TokenPrice {
    averagePrice: number;
    currentPrice: number;
  }