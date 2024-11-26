import axios from 'axios';
import * as dotenv from 'dotenv';
import { Variables, Order } from './types';
import { query } from './queries';
import { tokenConfig, networkConfig } from './config';
import { hideBin } from 'yargs/helpers';
import {orderMetrics, tokenMetrics, volumeMetrics, analyzeLiquidity} from './metrics'
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


    if (token === "ALL") {
      return { filteredActiveOrders: activeOrders, filteredInActiveOrders: inActiveOrders }; // Return all active orders without filtering
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
    const { filteredActiveOrders, filteredInActiveOrders } = await fetchAndFilterOrders(token, network);

    // Fetch logs
    let orderMetricsLogs = await orderMetrics(filteredActiveOrders, filteredInActiveOrders);

    let tokenArray = [];
    let liquidityAnalysisLog: string[] = [];
    let liquiditySummary = '';
    if (token === 'ALL') {
      const allTokens = new Map<string, { symbol: string; decimals: number; address: string }>();

      filteredActiveOrders.forEach((order: any) => {
        order.inputs.forEach((input: any) => {
          allTokens.set(input.token.address, {
            symbol: input.token.symbol,
            decimals: Number(input.token.decimals),
            address: input.token.address,
          });
        });
        order.outputs.forEach((output: any) => {
          allTokens.set(output.token.address, {
            symbol: output.token.symbol,
            decimals: Number(output.token.decimals),
            address: output.token.address,
          });
        });
      });

      tokenArray = Array.from(allTokens.entries()).map(([addressKey, details]) => ({
        addressKey,
        ...details,
      }));
    } else {
      const { symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = tokenConfig[token];
      tokenArray.push({
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        address: tokenAddress,
      });
      tokenArray = [...tokenArray, ...networkConfig[network].stables];

      const liquidityAnalysis = await analyzeLiquidity(tokenAddress);

      liquidityAnalysisLog.push(`Liquidity Analysis for ${tokenSymbol}:`);
      liquidityAnalysisLog.push(`- Total Pool Volume last 24 hours: ${liquidityAnalysis.totalPoolVolume} USD`);
      liquidityAnalysisLog.push(`- Total Pool Trades last 24 hours: ${liquidityAnalysis.totalPoolTrades}`);
      liquidityAnalysis.liquidityDataAggregated.forEach((pool: any) => {
        liquidityAnalysisLog.push(`  - Dex: ${pool.dex}`);
        liquidityAnalysisLog.push(`  - Pair Address: ${pool.pairAddress}`);
        liquidityAnalysisLog.push(`  - Pool Volume: ${pool.totalPoolVolume} USD`);
        liquidityAnalysisLog.push(`  - Pool Trades: ${pool.totalPoolTrades}`);
        liquidityAnalysisLog.push(`  - Pool Size: ${pool.totalPoolSizeUsd} USD`);
        liquidityAnalysisLog.push(`  - Base Token Liquidity: ${pool.poolBaseTokenLiquidity}`);
        liquidityAnalysisLog.push(`  - Quote Token Liquidity: ${pool.poolQuoteTokenLiquidity}`);

      });

      // Generate summary
      liquiditySummary = `${tokenSymbol}'s trading activity represents about ${(liquidityAnalysis.totalPoolVolume / 10000).toFixed(2)}% of the total volume across ${
        liquidityAnalysis.liquidityDataAggregated.length
      } ${liquidityAnalysis.liquidityDataAggregated.map((pool: any) => pool.dex).join(', ')} pools. The pools show varying activity levels with ${
        liquidityAnalysis.totalPoolTrades
      } total trades.`;
    }

    let tokenMetricsLogs = await tokenMetrics(filteredActiveOrders, tokenArray);
    let { aggregatedResults, processOrderLogMessage } = await volumeMetrics(network, filteredActiveOrders);

    // Generate summary
    const recentOrderDate = filteredActiveOrders.length
      ? new Date(
          Math.max(...filteredActiveOrders.map((order: any) => new Date(Number(order.timestampAdded)).getTime()))
        ).toISOString()
      : null;

    const totalTrades = aggregatedResults.reduce((sum: any, entry: any) => sum + parseFloat(entry.total24h), 0);
    const totalVolumeUsd = aggregatedResults.reduce((sum: any, entry: any) => sum + parseFloat(entry.total24hAveUsd), 0);

    const summarizedMessage = `
Recent performance data for ${token} on ${network.toUpperCase()} shows ${
      filteredActiveOrders.length
    } active orders managed by ${
      new Set(filteredActiveOrders.map((order: any) => order.owner)).size
    } unique owners. The most recent order was placed on ${recentOrderDate}.
    
In the past 24 hours, raindex supported ${totalTrades.toFixed(2)} tokens (${totalVolumeUsd.toFixed(
      2
    )} USD) in trading volume. ${liquiditySummary}
`;

    // Combine all logs into a single Markdown string
    const markdownInput = `
      # Network Analysis for ${network}

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

    console.log(markdownInput)

    // Use ChatGPT API to format the logs into professional markdown
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
