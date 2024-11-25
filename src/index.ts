import axios from 'axios';
import * as dotenv from 'dotenv';
import { Variables, Order } from './types';
import { query } from './queries';
import { tokenConfig, networkConfig } from './config';
import { hideBin } from 'yargs/helpers';
import {orderMetrics, tokenMetrics, volumeMetrics} from './metrics'
import yargs from 'yargs';

dotenv.config();

async function fetchAndFilterOrders(token: string , network: string, skip = 0, first = 1000): Promise<any> {
  const variables: Variables = { skip, first };

  const endpoint = networkConfig[network].subgraphUrl

  try {
    const response = await axios.post(endpoint, {
      query,
      variables,
    });

    const orders: Order[] = response.data.data.orders;
    const activeOrders = orders.filter(order => order.active)
    const inActiveOrders = orders.filter(order => !order.active)

    if (token === 'ALL') {
      console.log(`Fetching orders for all tokens on network: ${network}`);
      return {activeOrders, inActiveOrders}; // Return all active orders without filtering
    }
    const {symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = tokenConfig[token] 

    console.log(`Fetching orders for token: ${tokenSymbol} on network: ${network}`);

    // Filter orders where inputs.token.symbol or outputs.token.symbol matches the specified token
    const filteredActiveOrders = activeOrders.filter(order =>
      order.inputs.some(input => input.token.symbol === tokenSymbol) ||
      order.outputs.some(output => output.token.symbol === tokenSymbol)
    );

    const filteredInActiveOrders = inActiveOrders.filter(order =>
      order.inputs.some(input => input.token.symbol === tokenSymbol) ||
      order.outputs.some(output => output.token.symbol === tokenSymbol)
    );

    return {filteredActiveOrders, filteredInActiveOrders};

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching orders:', error.message);
    } else {
      console.error('Unexpected error:', JSON.stringify(error));
    }
    throw error;
  }
}

async function singleNetwork(token: string, network: string) {
    try {
        const {filteredActiveOrders, filteredInActiveOrders} = await fetchAndFilterOrders(token, network);
        const {aggregatedResults} = await volumeMetrics(network, filteredActiveOrders)

        await orderMetrics(filteredActiveOrders, filteredInActiveOrders)
        let tokenArray = []        
        if (token === 'ALL') {
          const allTokens = new Map<string, { symbol: string; decimals: number; address: string }>();

          filteredActiveOrders.forEach((order : any) => {
            order.inputs.forEach((input: any) => {
              allTokens.set(input.token.address, {
                symbol: input.token.symbol,
                decimals: Number(input.token.decimals),
                address: input.token.address
              });
            });
            order.outputs.forEach((output: any) => {
              allTokens.set(output.token.address, {
                symbol: output.token.symbol,
                decimals: Number(output.token.decimals),
                address: output.token.address
              });
            });
          });

          // Convert the Map to an array if needed
          tokenArray = Array.from(allTokens.entries()).map(([addressKey, details]) => ({
            addressKey,
            ...details,
          }));

        } else {
          const {symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = tokenConfig[token] 
          tokenArray.push(
            {
              symbol: tokenSymbol,
              decimals : tokenDecimals,
              address: tokenAddress
            }
          )
          tokenArray = [...tokenArray, ...networkConfig[network].stables];
        }

        await tokenMetrics(filteredActiveOrders,tokenArray)
        
        console.log('Aggregated Volumes:', aggregatedResults);
        
    } catch (error) {
        console.error('Error analyzing orders:', error);
    }
}

async function multiNetwork(token: string, network: string) {    
    const networkKeys: string[] = Object.keys(networkConfig);
    for(const network of networkKeys){
      console.log(`--------------------------------------------------- ${network.toUpperCase()} ---------------------------------------------------`)
      await singleNetwork(token, network)
    }
}

async function analyzeOrders(token: string, network: string) {
  if(token === "ALL" && network === "ALL"){ 
    multiNetwork(token, network);
  } else{
    singleNetwork(token, network)
  }
}

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
  .option('token', {
    alias: 't',
    type: 'string',
    description: 'The token symbol (e.g., IOEN, TFT, or ALL)',
    demandOption: true,
  })
  .option('network', {
    alias: 'n',
    type: 'string',
    description: 'The network name (e.g., polygon, bsc)',
    demandOption: true,
  })
  .help()
  .alias('help', 'h')
  .argv as { token: string; network: string };

// Extract token and network from arguments
const { token, network } = argv;
  
analyzeOrders(token, network);
