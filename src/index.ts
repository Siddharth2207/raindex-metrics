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

async function singleNetwork(token: string, network: string, durationInSeconds: number) {
  try {
    const { filteredActiveOrders, filteredInActiveOrders } = await fetchAndFilterOrders(token, network);

    let orderMetricsLogs = await orderMetrics(filteredActiveOrders, filteredInActiveOrders);
    let summarizedMessage = '';

    const { symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = tokenConfig[token];

    const { 
      liquidityAnalysisLog,
      totalTokenExternalVolForDurationUsd,
      totalTokenExternalTradesForDuration
    } = await analyzeLiquidity(network, token, durationInSeconds);


    let tokenMetricsLogs = await tokenMetrics(filteredActiveOrders);
    let combinedBalance = await calculateCombinedVaultBalance(filteredActiveOrders.concat(filteredInActiveOrders));
    let { tradesLastForDuration: totalRaindexTradesForDuration, aggregatedResults, processOrderLogMessage } = await volumeMetrics(
      network,
      filteredActiveOrders.concat(filteredInActiveOrders),
      durationInSeconds
    );

    const totalRaindexVolumeUsd = aggregatedResults.filter((e: any) => {return e.address.toLowerCase() == tokenAddress.toLocaleLowerCase()})[0].totalVolumeForDurationUsd;
    
    summarizedMessage = `
      Insight 1 : 
      
      Total Raindex trades ${duration} : ${totalRaindexTradesForDuration}
      Total external trades ${duration} : ${totalTokenExternalTradesForDuration- totalRaindexTradesForDuration}
      Total trades ${duration} : ${totalTokenExternalTradesForDuration}
      Total Raindex token volume ${duration} : ${totalRaindexVolumeUsd}
      Total external volume ${duration} : ${totalTokenExternalVolForDurationUsd-totalRaindexVolumeUsd}
      Total  volume ${duration} : ${totalTokenExternalVolForDurationUsd}
      Raindex trades as a % of total trades % = ${((totalRaindexTradesForDuration/totalTokenExternalTradesForDuration) * 100).toFixed(2)}
      Raindex volume as a % of total volume % = ${((totalRaindexVolumeUsd/totalTokenExternalVolForDurationUsd) * 100).toFixed(2)}

      Insight 2 : 
      Current value vault balances in USD : ${combinedBalance}
      Raindex daily volume as a % of vault balance : ${totalRaindexVolumeUsd/combinedBalance}     
    `
    
    
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

    // console.log(markdownInput)
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

async function analyzeOrders(token: string, network: string, duration: string) {

  let durationInSeconds = 0 
  if(duration === 'daily'){
    durationInSeconds = 24 * 60 * 60
  }else if(duration === 'weekly'){
    durationInSeconds = 7 * 24 * 60 * 60
  }else if(duration === 'monthly'){
    durationInSeconds = 30 * 24 * 60 * 60
  }
  singleNetwork(token, network, durationInSeconds)
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
  .option('duration', {
    alias: 'd',
    type: 'string',
    description: 'Duration (daily, weekly, monthly)'
  })
  .help()
  .alias('help', 'h')
  .argv as { token: string; network: string; duration: string };

// Extract token and network from arguments
const { token, network, duration } = argv;

console.log('token : ', token)
console.log('network : ', network)
console.log('duration : ', duration)

  
analyzeOrders(token, network, duration);
