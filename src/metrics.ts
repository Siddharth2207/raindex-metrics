import axios from 'axios';
import { ethers } from 'ethers';
import { tradeQuery } from './queries';
import { tokenConfig, networkConfig } from './config';
import { LiquidityPool, TokenPair, TokenPrice } from './types';
import { HypersyncClient, presetQueryLogsOfEvent, QueryResponse, Log } from '@envio-dev/hypersync-client';


const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);


export async function orderMetrics(filteredActiveOrders: any[], filteredInActiveOrders: any[]) {
  const totalActiveOrders = filteredActiveOrders.length;
  const totalInActiveOrders = filteredInActiveOrders.length;

  const allOrders: any[] = filteredActiveOrders.concat(filteredInActiveOrders);

  const uniqueOwners = new Set(allOrders.map(order => order.owner)).size;
  const lastOrderDate = allOrders.length
    ? new Date(Math.max(
      ...allOrders.map(order => new Date(Number(order.timestampAdded)).getTime())
    ) * 1000).toISOString()
    : null;

  const ordersLast24Hours = allOrders.filter(order =>
    new Date(Number(order.timestampAdded) * 1000) >= last24Hours
  );
  const ordersLastWeek = allOrders.filter(order =>
    new Date(Number(order.timestampAdded) * 1000) >= lastWeek
  );

  const uniqueOwnersLast24Hours = new Set(
    ordersLast24Hours.map(order => order.owner)
  ).size;
  const uniqueOwnersLastWeek = new Set(
    ordersLastWeek.map(order => order.owner)
  ).size;

  // Aggregate all log messages into a single string
  const logMessages = [
    `Total Active Orders: ${totalActiveOrders}`,
    `Total InActive Orders: ${totalInActiveOrders}`,
    `Unique Owners: ${uniqueOwners}`,
    `Last Order Date: ${lastOrderDate}`,
    `Orders added in last 24 hrs: ${ordersLast24Hours.length}`,
    `Orders added in last week: ${ordersLastWeek.length}`,
    `Unique owners in last 24 hrs: ${uniqueOwnersLast24Hours}`,
    `Unique owners in last week: ${uniqueOwnersLastWeek}`,
  ];

  return logMessages
}

async function getTokenPriceUsd(tokenAddress: string, tokenSymbol: string): Promise<TokenPrice> {
  try {

    if (tokenSymbol.includes('USD')) {
      return {
        averagePrice: 1,
        currentPrice: 1,
      };
    }
    const response = await axios.get<{ pairs: TokenPair[] }>(
      `https://api.dexscreener.io/latest/dex/search?q=${tokenAddress}`
    );

    const pairs = response.data?.pairs || [];
    if (pairs.length === 0) {
      console.warn(`No pairs found for token ${tokenAddress}`);
      return { averagePrice: 0, currentPrice: 0 };
    }

    let currentPrice = 0;
    let averagePrice = 0;

    // Handle WFLR special case
    if (tokenAddress.toLowerCase() === '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d') {
      const specialPair = pairs.find(
        (pair) =>
          pair.baseToken.address.toLowerCase() === '0xfbda5f676cb37624f28265a144a48b0d6e87d3b6'.toLowerCase() &&
          pair.quoteToken.address.toLowerCase() === '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d'.toLowerCase()
      );

      if (specialPair) {

        currentPrice = (1 / parseFloat(specialPair.priceNative)) || 0;

        const priceChange24h = parseFloat(specialPair.priceChange?.h24) || 0;
        if (currentPrice > 0 && priceChange24h !== 0) {
          const priceStart = currentPrice / (1 + priceChange24h / 100);
          averagePrice = (currentPrice + priceStart) / 2;
        } else {
          averagePrice = currentPrice;
        }

        return { averagePrice, currentPrice };
      } else {
        console.warn(`Special pair not found for token ${tokenAddress}`);
        return { averagePrice: 0, currentPrice: 0 };
      }
    }

    // Default case: use the first pair
    const firstPair = pairs[0];
    currentPrice = parseFloat(firstPair?.priceUsd) || 0;

    const priceChange24h = parseFloat(firstPair?.priceChange?.h24) || 0;
    if (currentPrice > 0 && priceChange24h !== 0) {
      const priceStart = currentPrice / (1 + priceChange24h / 100);
      averagePrice = (currentPrice + priceStart) / 2;
    } else {
      averagePrice = currentPrice;
    }

    return { averagePrice, currentPrice };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(`Error fetching price for token ${tokenAddress}: ${error.message}`);
    } else {
      console.error(`Unexpected error fetching price for token ${tokenAddress}:`, error);
    }
    return { averagePrice: 0, currentPrice: 0 };
  }
}

export async function calculateCombinedVaultBalance(orders: any) {
  let combinedBalanceUsd = 0;

  // Use a Set to track processed vault IDs
  const processedVaultIds = new Set();

  for (const order of orders) {
    const vaults = [...order.inputs, ...order.outputs];

    for (const vault of vaults) {
      // Check if the vault ID has already been processed
      if (processedVaultIds.has(vault.id)) continue;

      // Mark the vault as processed
      processedVaultIds.add(vault.id);

      const tokenAddress = vault.token.address;
      const tokenDecimals = parseInt(vault.token.decimals, 10);
      const balance = ethers.utils.formatUnits(vault.balance, tokenDecimals);

      // Fetch the price of the token in USD
      const { currentPrice: currentTokenPrice } = await getTokenPriceUsd(tokenAddress, vault.token.symbol);

      // Calculate the vault's balance in USD
      const vaultBalanceUsd = parseFloat(balance) * currentTokenPrice;
      combinedBalanceUsd += vaultBalanceUsd;
    }
  }

  return combinedBalanceUsd;
}

export async function tokenMetrics(filteredActiveOrders: any[]): Promise<string[]> {
  const logMessages: string[] = [];

  // Extract all tokens from outputs and inputs
  const allTokens = filteredActiveOrders.flatMap(order =>
    [...order.outputs, ...order.inputs].map(item => item.token)
  );

  // Create a Map to ensure unique tokens based on `address`
  const uniqueTokensMap = new Map();

  allTokens.forEach(token => {
    if (!uniqueTokensMap.has(token.address)) {
      uniqueTokensMap.set(token.address, {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals
      });
    }
  });

  // Convert the Map back to an array
  const uniqueTokens = Array.from(uniqueTokensMap.values());

  // Add table header
  logMessages.push(
    `| Symbol | Total Vaults | Total Tokens | Price (USD) | Value (USD) |`,
    `|--------|--------------|--------------|-------------|-------------|`
  );

  for (const token of uniqueTokens) {
    const { symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = token;

    const { currentPrice } = await getTokenPriceUsd(tokenAddress, tokenSymbol);

    const uniqueEntries = new Set<string>();

    const fundedOrders = filteredActiveOrders.filter((order) => {
      let inputsFunded, outputsFunded;

      for (let i = 0; i < order.inputs.length; i++) {
        let inputVault = order.inputs[i];
        if (inputVault.token.symbol === tokenSymbol && inputVault.balance > 0) {
          inputsFunded = true;
        }
      }

      for (let i = 0; i < order.outputs.length; i++) {
        let outputVault = order.outputs[i];
        if (outputVault.token.symbol === tokenSymbol && outputVault.balance > 0) {
          outputsFunded = true;
        }
      }

      return inputsFunded || outputsFunded || false;
    });

    logMessages.push(`Funded Active Orders for ${tokenSymbol}: ${fundedOrders.length}`);

    const totalInputsVaults = filteredActiveOrders
      .flatMap(order => order.inputs)
      .filter(input => input.token.address === tokenAddress);

    const totalInputs = totalInputsVaults.reduce((sum, input) => {
      const uniqueKey = input.id;
      uniqueEntries.add(uniqueKey); // Track all inputs
      return sum.add(ethers.BigNumber.from(input.balance));
    }, ethers.BigNumber.from(0));

    const totalOutputsVaults = filteredActiveOrders
      .flatMap(order => order.outputs)
      .filter(output => output.token.address === tokenAddress);

    const totalOutputs = totalOutputsVaults.reduce((sum, output) => {
      const uniqueKey = output.id;
      if (!uniqueEntries.has(uniqueKey)) {
        // Only add if it's not already counted in inputs
        uniqueEntries.add(uniqueKey);
        return sum.add(ethers.BigNumber.from(output.balance));
      }
      return sum; // Skip duplicates
    }, ethers.BigNumber.from(0));

    const totalTokens = ethers.utils.formatUnits(totalInputs.add(totalOutputs), tokenDecimals);
    const totalVaults = uniqueEntries.size;
    const totalValueUsd = parseFloat(totalTokens) * currentPrice;

    // Add a row to the table
    logMessages.push(
      `| ${tokenSymbol} | ${totalVaults} | ${totalTokens} | ${currentPrice} | ${totalValueUsd} |`
    );
  }

  return logMessages;
}


export async function volumeMetrics(network: string, filteredOrders: any[], durationInSeconds: number): Promise<any> {

  const endpoint = networkConfig[network].subgraphUrl;
  const { tradesLastForDuration, aggregatedResults, processOrderLogMessage } = await processOrdersWithAggregation(endpoint, filteredOrders, durationInSeconds);

  return { tradesLastForDuration, aggregatedResults, processOrderLogMessage }
}

async function fetchTrades(endpoint: string, orderHash: string): Promise<any[]> {
  try {
    const response = await axios.post(endpoint, {
      query: tradeQuery,
      variables: { orderHash },
    });
    return response.data.data.trades || [];
  } catch (error) {
    console.error(`Error fetching trades for order ${orderHash}:`, error);
    throw error;
  }
}

async function processOrdersWithAggregation(endpoint: string, filteredOrders: any[], durationInSeconds: number): Promise<{ tradesLastForDuration: number, aggregatedResults: any[]; processOrderLogMessage: string[] }> {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const aggregatedVolumes: Record<string, { totalVolumeForDuration: ethers.BigNumber; decimals: number; address: string, symbol: string }> = {};

  let orderTrades = [];
  let processOrderLogMessage: string[] = [];

  for (const order of filteredOrders) {
    const orderHash = order.orderHash;

    try {
      // Fetch trades for the order
      const trades = await fetchTrades(endpoint, orderHash);

      orderTrades.push({
        orderHash: orderHash,
        trades: trades
      });

      // Calculate volumes for the trades
      const volumes = calculateVolumes(trades, currentTimestamp, durationInSeconds);

      // Aggregate token volumes
      volumes.forEach(volume => {
        const token = volume.token;
        const decimals = volume.decimals;
        const address = volume.address;

        if (!aggregatedVolumes[address]) {
          aggregatedVolumes[address] = {
            totalVolumeForDuration: ethers.BigNumber.from(0),
            decimals: decimals,
            address,
            symbol: token
          };
        }

        aggregatedVolumes[address].totalVolumeForDuration = aggregatedVolumes[address].totalVolumeForDuration.add(ethers.utils.parseUnits(volume.totalVolumeForDuration, decimals));
      });
    } catch (error) {
      console.error(`Error processing order ${orderHash}:`, error);
      processOrderLogMessage.push(`Error processing order ${orderHash}: ${error}`);
    }
  }

  const totalTrades = orderTrades.reduce((sum, order) => sum + order.trades.length, 0);

  const tradesLastForDuration = orderTrades
    .flatMap(order => order.trades)
    .filter(trade => new Date(Number(trade.timestamp) * 1000) >= new Date(Date.now() - (durationInSeconds * 1000))).length;


  const { tradeDistributionForDuration, volumeDistributionForDuration } = await calculateTradeDistribution(orderTrades, durationInSeconds);

  let logString = 'For Duration'
  if (durationInSeconds === 86400) {
    logString = '24 hours'
  } else if (durationInSeconds === 86400 * 7) {
    logString = 'week'
  } else if (durationInSeconds === 86400 * 30) {
    logString = 'month'
  }

  processOrderLogMessage.push(`Trade Metrics:`);
  processOrderLogMessage.push(`- Trades in last ${logString}: ${tradesLastForDuration}`);
  processOrderLogMessage.push(`- Total Historical Trades: ${totalTrades}`);
  processOrderLogMessage.push(`- Trade Distribution in ${logString} by Order: ${JSON.stringify(tradeDistributionForDuration, null, 2)}`);
  processOrderLogMessage.push(`- Volume Distribution in ${logString} by Order: ${JSON.stringify(volumeDistributionForDuration, null, 2)}`);


  // Format aggregated volumes for printing
  let aggregatedResults = Object.entries(aggregatedVolumes).map(([address, data]) => ({
    token: data.symbol,
    address: data.address,
    decimals: data.decimals,
    symbol: data.symbol,
    totalVolumeForDuration: ethers.utils.formatUnits(data.totalVolumeForDuration, data.decimals),
    totalVolumeForDurationUsd: 0,
    currentPrice: 0
  }));

  aggregatedResults = await convertVolumesToUSD(aggregatedResults);

  // Add aggregated volume metrics to processOrderLogMessage
  processOrderLogMessage.push(`Raindex Volume by Token and Total:`);

  aggregatedResults.forEach(entry => {
    processOrderLogMessage.push(`- **Token**: ${entry.token} - ${entry.address}`);
    processOrderLogMessage.push(`  - **Symbol**: ${entry.symbol}`);
    processOrderLogMessage.push(`  - **${entry.symbol} Currnet price**: ${entry.currentPrice} USD`);
    processOrderLogMessage.push(`  - **${logString} Volume**: ${entry.totalVolumeForDuration} ${entry.symbol}`);
    processOrderLogMessage.push(`  - **${logString} Volume (USD)**: ${entry.totalVolumeForDurationUsd} USD`);

  });

  return { tradesLastForDuration, aggregatedResults, processOrderLogMessage };
}

async function calculateTradeDistribution(
  orderTrades: any[],
  durationInSeconds: number
): Promise<{
  tradeDistributionForDuration: any[];
  volumeDistributionForDuration: any[];

  tokenVolumesPerOrder: Record<
    string,
    Record<
      string,
      {
        totalVolumeDuration: ethers.BigNumber;
        totalVolumeDurationUsd: string;
        inVolumeDuration: ethers.BigNumber;
        outVolumeDuration: ethers.BigNumber;
        currentPrice: number;
        decimals: number;
        address: string;
        symbol: string;
      }
    >
  >;
}> {

  const orderTradesForDuration = orderTrades.map(order => ({
    orderHash: order.orderHash,
    trades: order.trades.filter(
      (trade: any) => new Date(Number(trade.timestamp) * 1000) >= new Date(Date.now() - (durationInSeconds * 1000))
    ),
  }));

  const totalTradesForDuration = orderTradesForDuration.reduce(
    (sum, order) => sum + order.trades.length,
    0
  );

  const tradeDistributionForDuration = orderTradesForDuration.map(order => ({
    orderHash: order.orderHash,
    tradeCount: order.trades.length,
    tradePercentage: (
      (order.trades.length / totalTradesForDuration) *
      100
    ).toFixed(2),
  }));

  const { volumeDistributionForDuration, tokenVolumesPerOrder } = await getVolumeDistribution(orderTradesForDuration)

  return { tradeDistributionForDuration, volumeDistributionForDuration, tokenVolumesPerOrder };
}

async function getVolumeDistribution(orderTradesDuration: any[]) {
  const tokenVolumesPerOrder: Record<
    string,
    Record<
      string,
      {
        totalVolumeDuration: ethers.BigNumber;
        totalVolumeDurationUsd: string;
        inVolumeDuration: ethers.BigNumber;
        outVolumeDuration: ethers.BigNumber;
        currentPrice: number;
        decimals: number;
        address: string;
        symbol: string;
      }
    >
  > = {};

  for (let i = 0; i < orderTradesDuration.length; i++) {
    const { orderHash, trades } = orderTradesDuration[i];

    if (!tokenVolumesPerOrder[orderHash]) {
      tokenVolumesPerOrder[orderHash] = {};
    }

    for (const trade of trades) {
      const inputToken = trade.inputVaultBalanceChange.vault.token;
      const outputToken = trade.outputVaultBalanceChange.vault.token;

      const inputAmount = ethers.BigNumber.from(trade.inputVaultBalanceChange.amount);
      const outputAmount = ethers.BigNumber.from(trade.outputVaultBalanceChange.amount).abs();

      const initializeToken = async (orderHash: string, token: any) => {
        if (!tokenVolumesPerOrder[orderHash][token.address]) {
          const { currentPrice } = await getTokenPriceUsd(token.address, token.symbol);

          tokenVolumesPerOrder[orderHash][token.address] = {
            totalVolumeDuration: ethers.BigNumber.from(0),
            totalVolumeDurationUsd: "0",
            inVolumeDuration: ethers.BigNumber.from(0),
            outVolumeDuration: ethers.BigNumber.from(0),
            currentPrice,
            decimals: parseInt(token.decimals),
            address: token.address,
            symbol: token.symbol,
          };
        }
      };

      await initializeToken(orderHash, inputToken);
      await initializeToken(orderHash, outputToken);

      tokenVolumesPerOrder[orderHash][inputToken.address].inVolumeDuration =
        tokenVolumesPerOrder[orderHash][inputToken.address].inVolumeDuration.add(inputAmount);

      tokenVolumesPerOrder[orderHash][outputToken.address].outVolumeDuration =
        tokenVolumesPerOrder[orderHash][outputToken.address].outVolumeDuration.add(outputAmount);

      tokenVolumesPerOrder[orderHash][inputToken.address].totalVolumeDuration =
        tokenVolumesPerOrder[orderHash][inputToken.address].inVolumeDuration.add(
          tokenVolumesPerOrder[orderHash][inputToken.address].outVolumeDuration
        );

      tokenVolumesPerOrder[orderHash][outputToken.address].totalVolumeDuration =
        tokenVolumesPerOrder[orderHash][outputToken.address].inVolumeDuration.add(
          tokenVolumesPerOrder[orderHash][outputToken.address].outVolumeDuration
        );

      // Convert to USD using the current price
      tokenVolumesPerOrder[orderHash][inputToken.address].totalVolumeDurationUsd = (
        parseFloat(
          ethers.utils.formatUnits(
            tokenVolumesPerOrder[orderHash][inputToken.address].totalVolumeDuration,
            tokenVolumesPerOrder[orderHash][inputToken.address].decimals
          )
        ) * tokenVolumesPerOrder[orderHash][inputToken.address].currentPrice
      ).toFixed(2);

      tokenVolumesPerOrder[orderHash][outputToken.address].totalVolumeDurationUsd = (
        parseFloat(
          ethers.utils.formatUnits(
            tokenVolumesPerOrder[orderHash][outputToken.address].totalVolumeDuration,
            tokenVolumesPerOrder[orderHash][outputToken.address].decimals
          )
        ) * tokenVolumesPerOrder[orderHash][outputToken.address].currentPrice
      ).toFixed(2);
    }
  }

  // Calculate total volume (in USD) for all orders
  const totalVolumeUsd = Object.values(tokenVolumesPerOrder).reduce((total, tokens) => {
    return (
      total +
      Object.values(tokens).reduce((sum, token) => sum + parseFloat(token.totalVolumeDurationUsd), 0)
    );
  }, 0);

  // Calculate volume distribution for each order
  const volumeDistributionForDuration = Object.entries(tokenVolumesPerOrder).map(([orderHash, tokens]) => {
    const orderTotalVolumeUsd = Object.values(tokens).reduce(
      (sum, token) => sum + parseFloat(token.totalVolumeDurationUsd),
      0
    );

    return {
      orderHash,
      totalVolumeUsd: orderTotalVolumeUsd.toFixed(2),
      volumePercentage: ((orderTotalVolumeUsd / totalVolumeUsd) * 100).toFixed(2),
    };
  });

  return { volumeDistributionForDuration, tokenVolumesPerOrder }

}

function calculateVolumes(trades: any[], currentTimestamp: number, durationInSeconds: number) {
  const tokenVolumes: Record<
    string,
    {
      inVolumeForDuration: ethers.BigNumber;
      outVolumeForDuration: ethers.BigNumber;
      decimals: number;
      address: string;
      symbol: string
    }
  > = {};

  trades.forEach(trade => {
    const inputToken = trade.inputVaultBalanceChange.vault.token;
    const outputToken = trade.outputVaultBalanceChange.vault.token;

    const inputAmount = ethers.BigNumber.from(trade.inputVaultBalanceChange.amount);
    const outputAmount = ethers.BigNumber.from(trade.outputVaultBalanceChange.amount).abs();
    const tradeTimestamp = parseInt(trade.tradeEvent.transaction.timestamp);

    const timeDiff = currentTimestamp - tradeTimestamp;


    // Initialize token entry if not present
    const initializeToken = (token: any) => {
      if (!tokenVolumes[token.address]) {
        tokenVolumes[token.address] = {
          inVolumeForDuration: ethers.BigNumber.from(0),
          outVolumeForDuration: ethers.BigNumber.from(0),
          decimals: parseInt(token.decimals),
          address: token.address,
          symbol: token.symbol
        };
      }
    };

    initializeToken(inputToken);
    initializeToken(outputToken);

    if (timeDiff <= durationInSeconds) {
      tokenVolumes[inputToken.address].inVolumeForDuration = tokenVolumes[inputToken.address].inVolumeForDuration.add(inputAmount);
      tokenVolumes[outputToken.address].outVolumeForDuration = tokenVolumes[outputToken.address].outVolumeForDuration.add(outputAmount);
    }

  });

  // Format volumes
  return Object.entries(tokenVolumes).map(([tokenAddress, data]) => {
    const { inVolumeForDuration, outVolumeForDuration, decimals, address, symbol } = data;

    const totalVolumeForDuration = inVolumeForDuration.add(outVolumeForDuration);

    return {
      token: symbol,
      decimals: decimals,
      address: address,
      inVolumeForDuration: ethers.utils.formatUnits(inVolumeForDuration, decimals),
      outVolumeForDuration: ethers.utils.formatUnits(outVolumeForDuration, decimals),
      totalVolumeForDuration: ethers.utils.formatUnits(totalVolumeForDuration, decimals),
    };
  });
}

async function convertVolumesToUSD(data: any[]): Promise<any[]> {
  for (const item of data) {
    if (item.token && item.address) {
      const tokenAddress = item.address;

      // Fetch the current price of the token
      const { averagePrice, currentPrice } = await getTokenPriceUsd(tokenAddress, item.symbol);

      if (currentPrice > 0) {
        item.totalVolumeForDurationUsd = (parseFloat(item.totalVolumeForDuration) * currentPrice).toString();
        item.currentPrice = (parseFloat(currentPrice.toString())).toString();
      } else {
        console.warn(`Could not fetch price for token ${tokenAddress}. Skipping USD conversion.`);
        item.totalVolumeForDurationUsd = 0;
        item.currentPrice = 0;
      }
    }
  }

  return data;
}

async function fetchLiquidityData(tokenAddress: string): Promise<LiquidityPool[]> {
  const endpoint = `https://api.dexscreener.io/latest/dex/search?q=${tokenAddress}`;

  try {
    const response = await axios.get(endpoint);
    const data = response.data;

    if (data && data.pairs) {
      return data.pairs.map((pair: any) => ({
        volume24h: pair.volume?.h24 || 0,
        trades24h: pair.txns?.h24?.buys + pair.txns?.h24?.sells || 0,
        pairAddress: pair.pairAddress,
        dex: pair.dexId,
        poolSizeUsd: pair.liquidity.usd,
        poolBaseTokenLiquidity: `${pair.liquidity.base} ${pair.baseToken.symbol}`,
        poolQuoteTokenLiquidity: `${pair.liquidity.quote} ${pair.quoteToken.symbol}`,
        h24Buys: pair.txns?.h24?.buys || 0,
        h24Sells: pair.txns?.h24?.sells || 0,
        priceChange24h: pair.priceChange?.h24 || 0,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching liquidity data:', error);
    throw error;
  }
}

export async function analyzeLiquidity(network: string, token: string, durationInSeconds: number): Promise<any> {

  const { symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = tokenConfig[token];
  let liquidityAnalysisLog: string[] = [];
  let totalTokenExternalVolForDurationUsd, totalTokenExternalTradesForDuration;

  liquidityAnalysisLog.push(`Liquidity Analysis for ${tokenSymbol}:`);

  if (durationInSeconds == 86400) {
    const liquidityData = await fetchLiquidityData(tokenAddress);

    // Calculate total volumes and trades across all pools
    const totalPoolVolume = liquidityData.reduce((sum, pool) => sum + pool.volume24h, 0);
    const totalPoolTrades = liquidityData.reduce((sum, pool) => sum + pool.trades24h, 0);

    // Generate results
    const liquidityDataAggregated = liquidityData.map((pool: LiquidityPool) => ({
      dex: pool.dex,
      pairAddress: pool.pairAddress,
      totalPoolVolume: pool.volume24h.toFixed(2),
      totalPoolTrades: pool.trades24h,
      totalPoolSizeUsd: pool.poolSizeUsd,
      poolBaseTokenLiquidity: pool.poolBaseTokenLiquidity,
      poolQuoteTokenLiquidity: pool.poolQuoteTokenLiquidity,
      h24Buys: pool.h24Buys,
      h24Sells: pool.h24Sells,
      priceChange24h: pool.priceChange24h.toFixed(2),
    }));
    
    liquidityAnalysisLog.push(`- Total Pool Trades last 24 hours: ${totalPoolTrades}`);
    liquidityAnalysisLog.push(`- Total Pool Volume last 24 hours: ${totalPoolVolume} USD`);
    liquidityDataAggregated.forEach((pool: any) => {
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
    totalTokenExternalVolForDurationUsd = totalPoolVolume
    totalTokenExternalTradesForDuration = totalPoolTrades

  } else {
    const { 
      totalPoolVolumeUsdForDuration,
      totalPoolTradesForDuration, 
    } = await analyzeHyperSyncData(tokenConfig[token], networkConfig[network], durationInSeconds);

    totalTokenExternalVolForDurationUsd = totalPoolVolumeUsdForDuration;
    totalTokenExternalTradesForDuration = totalPoolTradesForDuration;

    liquidityAnalysisLog.push(` - Pool Volume for duration : ${totalTokenExternalVolForDurationUsd} USD`);
    liquidityAnalysisLog.push(` - Pool Trades for duration : ${totalTokenExternalTradesForDuration}`);
      
  }

  return {
    liquidityAnalysisLog,
    totalTokenExternalVolForDurationUsd,
    totalTokenExternalTradesForDuration,
  };
}

async function getBlockNumberForTimePeriod(network: any, seconds: any) {
  try {
    // Validate network object
    if (!network.rpc || !network.blockTime) {
      throw new Error('Invalid network object. Ensure "rpc" and "blockTime" are provided.');
    }

    // Calculate the number of blocks in the given time period
    const blocksInPeriod = Math.round(seconds / network.blockTime);

    // Fetch the latest block number
    const response = await axios.post(network.rpc, {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    });

    const latestBlockHex = response.data.result;
    const latestBlock = parseInt(latestBlockHex, 16);

    // Calculate the block number for the start of the time period
    const blockForPeriod = latestBlock - blocksInPeriod;

    return { blockForPeriod, latestBlock };
  } catch (error) {
    console.error('Error calculating block number:', error);
    throw error;
  }
}

async function analyzeHyperSyncData(token: any, network: any, durationInSeconds: number) {

  // Create hypersync client using the mainnet hypersync endpoint
  const hyperSyncClinet = HypersyncClient.new({
    url: `https://${network.chainId}.hypersync.xyz`
  });

  const { blockForPeriod, latestBlock } = await getBlockNumberForTimePeriod(network, durationInSeconds);

  const provider = new ethers.providers.JsonRpcProvider(network.rpc);
  const uniswapV2PoolAbi = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
  ];
  const erc20Abi = [
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
  ]; 

  const totalVolumeForTokens: Record<string, { totalTokenVolumeForDuration: number }> = {};
  let totalPoolTradesForDuration = 0;

  for(let i = 0; i < token.poolsV2.length; i++){
    const poolContractAddress = token.poolsV2[i];
    const poolContract = new ethers.Contract(poolContractAddress, uniswapV2PoolAbi, provider);
    const token0Address = await poolContract.token0();
    const token1Address = await poolContract.token1();

    const token0Contract = new ethers.Contract(token0Address, erc20Abi, provider);
    const token1Contract = new ethers.Contract(token1Address, erc20Abi, provider);

    const token0Decimals = await token0Contract.decimals();
    const token1Decimals = await token1Contract.decimals();

    const swapQueryResult = await fetchLogs(
      hyperSyncClinet,
      poolContractAddress,
      '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
      blockForPeriod,
      latestBlock
    );

    let totalAmount0 = ethers.BigNumber.from(0);
    let totalAmount1 = ethers.BigNumber.from(0);
    totalPoolTradesForDuration += swapQueryResult.length;
    
    for (let i = 0; i < swapQueryResult.length; i++) {
      let log = swapQueryResult[i]?.data;
  
      if (log !== undefined) {
        const logBytes = ethers.utils.arrayify(log);
        let decodedAmount = ethers.utils.defaultAbiCoder.decode(
          ["uint256", "uint256", "uint256", "uint256"],
          logBytes
        );
        totalAmount0 = totalAmount0.add(ethers.BigNumber.from(decodedAmount[0])).add(ethers.BigNumber.from(decodedAmount[2]));
        totalAmount1 = totalAmount1.add(ethers.BigNumber.from(decodedAmount[1])).add(ethers.BigNumber.from(decodedAmount[3]));
      } else {
        console.error("Hex string is undefined!");
      }
    }

    let totalAmount0Formated = parseFloat(ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals));
    let totalAmount1Formated = parseFloat(ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals));

    if (totalVolumeForTokens[token0Address.toLowerCase()]) {
      totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration += totalAmount0Formated;
    } else {
      totalVolumeForTokens[token0Address.toLowerCase()] = { totalTokenVolumeForDuration: totalAmount0Formated };
    }

    if (totalVolumeForTokens[token1Address.toLowerCase()]) {
      totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration += totalAmount1Formated;
    } else {
      totalVolumeForTokens[token1Address.toLowerCase()] = { totalTokenVolumeForDuration: totalAmount1Formated };
    }
    
  }

  for(let i = 0; i < token.poolsV3.length; i++){
    const poolContractAddress = token.poolsV3[i];
    const poolContract = new ethers.Contract(poolContractAddress, uniswapV2PoolAbi, provider);
    const token0Address = await poolContract.token0();
    const token1Address = await poolContract.token1();

    const token0Contract = new ethers.Contract(token0Address, erc20Abi, provider);
    const token1Contract = new ethers.Contract(token1Address, erc20Abi, provider);
    const token0Decimals = await token0Contract.decimals();
    const token1Decimals = await token1Contract.decimals();
    
    let totalAmount0 = ethers.BigNumber.from(0);
    let totalAmount1 = ethers.BigNumber.from(0);

    const swapQueryResult = await fetchLogs(
      hyperSyncClinet,
      poolContractAddress,
      '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
      blockForPeriod,
      latestBlock
    );

    totalPoolTradesForDuration += swapQueryResult.length;
    for (let i = 0; i < swapQueryResult.length; i++) {
      let log = swapQueryResult[i]?.data;
  
      if (log !== undefined) {
        const logBytes = ethers.utils.arrayify(log);
        let decodedAmount = ethers.utils.defaultAbiCoder.decode(
            ["int256", "int256", "uint160", "uint128","int24"],
            logBytes
        );
        totalAmount0 = totalAmount0.add(ethers.BigNumber.from(decodedAmount[0]).abs())
        totalAmount1 = totalAmount1.add(ethers.BigNumber.from(decodedAmount[1]).abs())
      } else {
        console.error("Hex string is undefined!");
      }
    }

    let totalAmount0Formated = parseFloat(ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals));
    let totalAmount1Formated = parseFloat(ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals));

    if (totalVolumeForTokens[token0Address.toLowerCase()]) {
      totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration += totalAmount0Formated;
    } else {
      totalVolumeForTokens[token0Address.toLowerCase()] = { totalTokenVolumeForDuration: totalAmount0Formated };
    }

    if (totalVolumeForTokens[token1Address.toLowerCase()]) {
      totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration += totalAmount1Formated;
    } else {
      totalVolumeForTokens[token1Address.toLowerCase()] = { totalTokenVolumeForDuration: totalAmount1Formated };
    }
    
  }

  const { currentPrice: currentTokenPrice } = await getTokenPriceUsd(token.address, token.symbol);
  
  const totalPoolVolumeUsdForDuration = totalVolumeForTokens[token.address.toLowerCase()].totalTokenVolumeForDuration * currentTokenPrice ;

  return { totalPoolVolumeUsdForDuration, totalPoolTradesForDuration }


}

async function fetchLogs(
  client: any,
  poolContract: string,
  eventTopic: string,
  startBlock: number,
  endBlock: number
): Promise<Array<Log>> {
  let currentBlock = startBlock;
  let logs: Array<Log> = [];

  while (currentBlock <= endBlock) {
    try {
      const queryResponse = await client.get(
        presetQueryLogsOfEvent(poolContract, eventTopic, currentBlock)
      );

      // Concatenate logs if there are any
      if (queryResponse.data.logs && queryResponse.data.logs.length > 0 && currentBlock != queryResponse.nextBlock) {
        logs = logs.concat(queryResponse.data.logs);
      }

      // Update currentBlock for the next iteration
      currentBlock = queryResponse.nextBlock;

      // Exit the loop if nextBlock is invalid
      if (!currentBlock || currentBlock > endBlock) {
        break;
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      break; // Exit loop on error
    }
  }

  return logs;
}
