import { Config, NetworkConfigurations } from './types';

// Example usage of the types
export const tokenConfig: Config = {
  IOEN: {
    symbol: 'IOEN',
    decimals: 18,
    network: 'polygon',
    address: '0xd0e9c8f5fae381459cf07ec506c1d2896e8b5df6'
  },
  TFT: {
    symbol: 'TFT',
    decimals: 7,
    network: 'bsc',
    address: '0x8f0fb159380176d324542b3a7933f0c2fd0c2bbf'
  }
};

export const networkConfig: NetworkConfigurations = {
  polygon: {
    chainId: 137,
    rpc: 'https://rpc.ankr.com/polygon',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-polygon/0.6/gn',
    stables:[
      {
        address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        symbol: 'USDC',
        decimals: 6
      },
      {
        address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        symbol: 'USDT',
        decimals: 6
      },
      {
        address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        symbol: 'WETH',
        decimals: 18
      }
    ]
  },
  bsc: {
    chainId: 56,
    rpc: 'https://rpc.ankr.com/bsc',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-bsc/2024-10-14-63f4/gn',
    stables:[
      {
        address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        symbol: 'BUSD',
        decimals: 18
      },
      {
        address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        symbol: 'WBNB',
        decimals: 18
      }
    ]
  },
};