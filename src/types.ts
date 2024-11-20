
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

export interface TokenConfig {
    symbol: string;
    decimals: number;
    subgraphUrl: string;
}

export interface NetworkConfig {
    [token: string]: TokenConfig;
}

export interface Config {
    [network: string]: NetworkConfig;
}
