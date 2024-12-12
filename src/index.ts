import axios from 'axios';
import * as dotenv from 'dotenv';
import { Variables, Order } from './types';
import { query } from './queries';
import { tokenConfig, networkConfig } from './config';
import { hideBin } from 'yargs/helpers';
import {orderMetrics, tokenMetrics, volumeMetrics, analyzeLiquidity, calculateCombinedVaultBalance} from './metrics'
import yargs from 'yargs';

dotenv.config();
const openaiToken = process.env.OPENAI_API_KEY as string;

async function fetchAndFilterOrders(token: string , network: string, skip = 0, first = 1000): Promise<{ filteredActiveOrders: Order[]; filteredInActiveOrders: Order[] }> {
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

    const {symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = tokenConfig[token] 

    console.log(`Fetching orders for token: ${tokenSymbol} on network: ${network}`);

    // Filter orders where inputs.token.symbol or outputs.token.symbol matches the specified token
    const filteredActiveOrders = activeOrders.filter(order =>
      order.inputs.some(input => input.token.symbol === tokenSymbol && input.token.address === tokenAddress) ||
      order.outputs.some(output => output.token.symbol === tokenSymbol && output.token.address === tokenAddress)
    );

    const filteredInActiveOrders = inActiveOrders.filter(order =>
      order.inputs.some(input => input.token.symbol === tokenSymbol && input.token.address === tokenAddress) ||
      order.outputs.some(output => output.token.symbol === tokenSymbol && output.token.address === tokenAddress)
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
    const { filteredActiveOrders, filteredInActiveOrders } = await fetchAndFilterOrders(token, network);

    let orderMetricsLogs = await orderMetrics(filteredActiveOrders, filteredInActiveOrders);

    let tokenArray = [];
    let liquidityAnalysisLog: string[] = [];
    let liquiditySummary = '';
    let summarizedMessage = '';

    let totalTokenExternal24hVolUsd, totalTokenExternal24hTrades

    const { symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = tokenConfig[token];
    tokenArray.push({
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      address: tokenAddress,
    });
    tokenArray = [...tokenArray];

    const liquidityAnalysis = await analyzeLiquidity(tokenAddress);

    totalTokenExternal24hVolUsd = liquidityAnalysis.totalPoolVolume
    totalTokenExternal24hTrades = liquidityAnalysis.totalPoolTrades

    liquidityAnalysisLog.push(`Liquidity Analysis for ${tokenSymbol}:`);
    liquidityAnalysisLog.push(`- Total Pool Trades last 24 hours: ${liquidityAnalysis.totalPoolTrades}`);
    liquidityAnalysisLog.push(`- Total Pool Volume last 24 hours: ${liquidityAnalysis.totalPoolVolume} USD`);
    liquidityAnalysis.liquidityDataAggregated.forEach((pool: any) => {
      liquidityAnalysisLog.push(`  - Dex: ${pool.dex}`);
      liquidityAnalysisLog.push(`  - Pair Address: ${pool.pairAddress}`);
      liquidityAnalysisLog.push(`  - Pool Volume: ${pool.totalPoolVolume} USD`);
      liquidityAnalysisLog.push(`  - Pool Trades: ${pool.totalPoolTrades}`);
      liquidityAnalysisLog.push(`  - Pool Size: ${pool.totalPoolSizeUsd} USD`);
      liquidityAnalysisLog.push(`  - Buys: ${pool.h24Buys}`);
      liquidityAnalysisLog.push(`  - Sell: ${pool.h24Sells}`);
      liquidityAnalysisLog.push(`  - Price Change: ${pool.priceChange24h}`);
      liquidityAnalysisLog.push(`  - Base Token Liquidity: ${pool.poolBaseTokenLiquidity}`);
      liquidityAnalysisLog.push(`  - Quote Token Liquidity: ${pool.poolQuoteTokenLiquidity}`);
    });

    liquiditySummary = `${tokenSymbol}'s trading activity represents about ${(liquidityAnalysis.totalPoolVolume / 10000).toFixed(
      2
    )}% of the total volume across ${
      liquidityAnalysis.liquidityDataAggregated.length
    } pools, including ${liquidityAnalysis.liquidityDataAggregated.map((pool: any) => pool.dex).join(', ')}.`;
    

    let tokenMetricsLogs = await tokenMetrics(filteredActiveOrders);
    let combinedBalance = await calculateCombinedVaultBalance(filteredActiveOrders.concat(filteredInActiveOrders));
    let { tradesLast24Hours, aggregatedResults, processOrderLogMessage } = await volumeMetrics(network, filteredActiveOrders.concat(filteredInActiveOrders));

    const totalVolumeUsd = aggregatedResults.reduce((sum: any, entry: any) => sum + parseFloat(entry.total24hUsd), 0);
    
    if (token !== 'ALL') {
        summarizedMessage = `
          Insight 1 : 
          
          Total Raindex trades last 24 hrs : ${tradesLast24Hours}
          Total external trades last 24 hrs : ${totalTokenExternal24hTrades- tradesLast24Hours}
          Total trades last 24 hrs : ${totalTokenExternal24hTrades}
          Total Raindex token volume last 24 hrs : ${totalVolumeUsd}
          Total external volume last 24 hrs : ${totalTokenExternal24hVolUsd-totalVolumeUsd}
          Total  volume last 24 hrs : ${totalTokenExternal24hVolUsd}
          Raindex trades as a % of total trades % = ${((tradesLast24Hours/totalTokenExternal24hTrades) * 100).toFixed(2)}
          Raindex volume as a % of total volume % = ${((totalVolumeUsd/totalTokenExternal24hVolUsd) * 100).toFixed(2)}

          Insight 2 : 
          Current value vault balances in USD : ${combinedBalance}
          Raindex daily volume as a % of vault balance : ${totalVolumeUsd/combinedBalance}     
      `
    }
    
    const markdownInput = `
# Network Analysis for ${network.toUpperCase()}

## Raindex Order Metrics
\`\`\`
${orderMetricsLogs.join('\n')}
\`\`\`

## Raindex Vaults by Token
\`\`\`
${tokenMetricsLogs.join('\n')}
\`\`\`

## Raindex Trades by Order
\`\`\`
${processOrderLogMessage.join('\n')}
\`\`\`

## External Liquidity Analysis
\`\`\`
${liquidityAnalysisLog.join('\n')}
\`\`\`

## Summary
${summarizedMessage}
`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that formats logs into professional markdown reports.',
          },
          {
            role: 'user',
            content: `Please format the following content into a clean, professional markdown report:\n\n${markdownInput}`,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiToken}`,
        },
      }
    );

    console.log(response.data.choices[0].message.content); // Formatted Markdown Log
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios Error:', error.response?.data || error.message);
    } else {
      console.error('Unexpected Error:', error);
    }
  }
}

async function analyzeOrders(token: string, network: string) {
  singleNetwork(token, network)
}

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
  .option('token', {
    alias: 't',
    type: 'string',
    description: 'The token symbol (e.g., IOEN, TFT)',
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
