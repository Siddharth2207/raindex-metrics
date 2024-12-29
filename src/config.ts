import { Config, NetworkConfigurations } from './types';

// Example usage of the types
export const tokenConfig: Config = {
  IOEN: {
    symbol: 'IOEN',
    decimals: 18,
    network: 'polygon',
    address: '0xd0e9c8f5fae381459cf07ec506c1d2896e8b5df6',
    contractPool: '0x316bc12871c807020ef8c1bc7771061c4e7a04ed',
    poolToken0: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    poolToken1: '0xd0e9c8f5fae381459cf07ec506c1d2896e8b5df6',
    topic0: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
  },
  MNW: {
    symbol: 'MNW',
    decimals: 18,
    network: 'polygon',
    address: '0x3c59798620e5fec0ae6df1a19c6454094572ab92',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  WPOL: {
    symbol: 'WPOL',
    network: 'polygon',
    decimals: 18,
    address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  QUICK_OLD: {
    symbol: 'QUICK',
    network: 'polygon',
    decimals: 18,
    address: '0xb5c064f955d8e7f38fe0460c556a72987494ee17',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  QUICK_NEW: {
    symbol: 'QUICK',
    network: 'polygon',
    decimals: 18,
    address: '0x831753dd7087cac61ab5644b308642cc1c33dc13',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  TFT: {
    symbol: 'TFT',
    decimals: 7,
    network: 'bsc',
    address: '0x8f0fb159380176d324542b3a7933f0c2fd0c2bbf',
    contractPool: '0x4a2dbaa979a3f4cfb8004ea5743faf159dd2665a',
    poolToken0: '0x8f0fb159380176d324542b3a7933f0c2fd0c2bbf',
    poolToken1: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    topic0: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
  },
  cysFLR: {
    symbol: 'cysFLR',
    decimals: 18,
    network: 'flare',
    address: '0x19831cfb53a0dbead9866c43557c1d48dff76567',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  cUSDX: {
    symbol: 'cUSDX',
    decimals: 6,
    network: 'flare',
    address: '0xfe2907dfa8db6e320cdbf45f0aa888f6135ec4f8',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  PAID: {
    symbol: 'PAID',
    network: 'base',
    decimals: 18,
    address: '0x655a51e6803faf50d4ace80fa501af2f29c856cf',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  LUCKY: {
    symbol: 'LUCKY',
    network: 'base',
    decimals: 18,
    address: '0x2c002ffec41568d138acc36f5894d6156398d539',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  WLTH: {
    symbol: 'WLTH',
    network: 'base',
    decimals: 18,
    address: '0x99b2b1a2adb02b38222adcd057783d7e5d1fcc7d',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  WFLR: {
    symbol: 'WFLR',
    network: 'flare',
    decimals: 18,
    address: '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  sFLR: {
    symbol: 'sFLR',
    network: 'flare',
    decimals: 18,
    address: '0x12e605bc104e93b45e1ad99f9e555f659051c2bb',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  PAI: {
    symbol: 'PAI',
    network: 'mainnet',
    decimals: 18,
    address: '0x13e4b8cffe704d3de6f19e52b201d92c21ec18bd',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  LOCK: {
    symbol: 'LOCK',
    network: 'mainnet',
    decimals: 18,
    address: '0x922d8563631b03c2c4cf817f4d18f6883aba0109',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
  UMJA: {
    symbol: 'UMJA',
    network: 'arbitrum',
    decimals: 18,
    address: '0x16A500Aec6c37F84447ef04E66c57cfC6254cF92',
    contractPool: '',
    poolToken0: '',
    poolToken1: '',
    topic0: ''
  },
};

export const networkConfig: NetworkConfigurations = {
  polygon: {
    chainId: 137,
    rpc: 'https://rpc.ankr.com/polygon',
    blockTime: 2.1,
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-matic/2024-12-13-d2b4/gn',
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
      },
      {
        address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        symbol: 'WPOL',
        decimals: 18
      }
    ]
  },
  arbitrum: {
    chainId: 42161,
    rpc: 'https://rpc.ankr.com/arbitrum',
    blockTime: 1.2,
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-arbitrum-one/2024-12-13-7435/gn',
    stables:[
      {
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        symbol: 'USDC',
        decimals: 6
      },
      {
        address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        symbol: 'WETH',
        decimals: 18
      }
    ]
  },
  bsc: {
    chainId: 56,
    rpc: 'https://rpc.ankr.com/bsc',
    blockTime: 3,
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-bsc/2024-12-13-2244/gn',
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
      },
      {
        address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        symbol: 'USDC',
        decimals: 18
      }
    ]
  },
  base: {
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    blockTime: 12,
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-base/2024-12-13-9c39/gn',
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
    blockTime: 3,
    rpc: 'https://rpc.ankr.com/flare',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-flare/2024-12-13-9dc7/gn',
    stables:[]
  },
  mainnet: {
    chainId: 1,
    blockTime: 12,
    rpc: 'https://rpc.ankr.com/eth',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-mainnet/2024-12-13-7f22/gn',
    stables:[
      {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
        decimals: 18
      },
      {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        decimals: 6
      },
      {
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        symbol: 'USDT',
        decimals: 6
      }
    ]
  }
};