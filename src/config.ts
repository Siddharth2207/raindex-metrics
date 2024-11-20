import { Config } from './types';

export const config: Config = {
    polygon: {
      IOEN: {
        symbol: 'IOEN',
        decimals: 18,
        subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-polygon/0.6/gn',
      }
    },
    bsc: {
      TFT: {
        symbol: 'TFT',
        decimals: 7,
        subgraphUrl: 'https://api.goldsky.com/api/public/project_clv14x04y9kzi01saerx7bxpg/subgraphs/ob4-bsc/2024-10-14-63f4/gn',
      },
    },
  };
  