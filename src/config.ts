import { Config, NetworkConfigurations } from './types';

// Example usage of the types
export const tokenConfig: Config = {
  IOEN: {
    symbol: 'IOEN',
    decimals: 18,
    network: 'polygon',
    address: '0xd0e9c8f5fae381459cf07ec506c1d2896e8b5df6'
  },
  WPOL: {
    symbol: 'WPOL',
    network: 'polygon',
    decimals: 18,
    address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
  },
  QUICK_NEW: {
    symbol: 'QUICK',
    network: 'polygon',
    decimals: 18,
    address: '0xb5c064f955d8e7f38fe0460c556a72987494ee17'
  },
  QUICK_OLD: {
    symbol: 'QUICK',
    network: 'polygon',
    decimals: 18,
    address: '0x831753dd7087cac61ab5644b308642cc1c33dc13'
  },
  TFT: {
    symbol: 'TFT',
    decimals: 7,
    network: 'bsc',
    address: '0x8f0fb159380176d324542b3a7933f0c2fd0c2bbf'
  },
  PAID: {
    symbol: 'PAID',
    network: 'base',
    decimals: 18,
    address: '0x655a51e6803faf50d4ace80fa501af2f29c856cf'
  },
  LUCKY: {
    symbol: 'LUCKY',
    network: 'base',
    decimals: 18,
    address: '0x2c002ffec41568d138acc36f5894d6156398d539'
  },
  WLTH: {
    symbol: 'WLTH',
    network: 'base',
    decimals: 18,
    address: '0x99b2b1a2adb02b38222adcd057783d7e5d1fcc7d'
  },
  WFLR: {
    symbol: 'WFLR',
    network: 'flare',
    decimals: 18,
    address: '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d'
  },
  sFLR: {
    symbol: 'sFLR',
    network: 'flare',
    decimals: 18,
    address: '0x12e605bc104e93b45e1ad99f9e555f659051c2bb'
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
  base: {
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-base/0.9/gn',
    stables:[
      {
        address: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        decimals: 18
      },
      {
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        symbol: 'USDC',
        decimals: 6
      }
    ]
  },
  flare: {
    chainId: 14,
    rpc: 'https://rpc.ankr.com/flare',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-flare/0.8/gn',
    stables:[]
  }
};