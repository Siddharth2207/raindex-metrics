import axios from 'axios';
import { ethers } from 'ethers';
import { tradeQuery } from './queries';
import { networkConfig } from './config';
import { LiquidityPool, TokenPair, TokenPrice } from './types';

const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export async function orderMetrics(filteredActiveOrders: any[], filteredInActiveOrders: any[]) {
  const totalActiveOrders = filteredActiveOrders.length;
  const totalInActiveOrders = filteredInActiveOrders.length;

  const uniqueOwners = new Set(filteredActiveOrders.map(order => order.owner)).size;
  const lastOrderDate = filteredActiveOrders.length
    ? new Date(Math.max(
      ...filteredActiveOrders.map(order => new Date(Number(order.timestampAdded)).getTime())
    ) * 1000).toISOString()
    : null;

  const ordersLast24Hours = filteredActiveOrders.filter(order =>
    new Date(Number(order.timestampAdded) * 1000) >= last24Hours
  );
  const ordersLastWeek = filteredActiveOrders.filter(order =>
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

async function getTokenPriceUsd(tokenAddress: string): Promise<TokenPrice> {
  try {
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
          pair.baseToken.address.toLowerCase() === '0x12e605bc104e93b45e1ad99f9e555f659051c2bb' &&
          pair.quoteToken.address.toLowerCase() === '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d'
      );

      if (specialPair) {
        currentPrice = parseFloat(specialPair.priceUsd) || 0;

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
      const {currentPrice: currentTokenPrice} = await getTokenPriceUsd(tokenAddress);

      // Calculate the vault's balance in USD
      const vaultBalanceUsd = parseFloat(balance) * currentTokenPrice;
      combinedBalanceUsd += vaultBalanceUsd;
    }
  }

  return combinedBalanceUsd;
}

export async function tokenMetrics(filteredOrders: any[], tokensArray: any[]): Promise<string[]> {
  const logMessages: string[] = [];

  for (const token of tokensArray) {
    const { symbol: tokenSymbol, decimals: tokenDecimals, address: tokenAddress } = token;

    const {currentPrice} = await getTokenPriceUsd(tokenAddress)

    const uniqueEntries = new Set<string>();

    const fundedOrders = filteredOrders.filter((order) => {
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

    logMessages.push(`Funded Orders for ${tokenSymbol}: ${fundedOrders.length}`);

    const totalInputsVaults = filteredOrders
      .flatMap(order => order.inputs)
      .filter(input => input.token.address === tokenAddress);

    const totalInputs = totalInputsVaults.reduce((sum, input) => {
      const uniqueKey = input.id;
      uniqueEntries.add(uniqueKey); // Track all inputs
      return sum.add(ethers.BigNumber.from(input.balance));
    }, ethers.BigNumber.from(0));

    const totalOutputsVaults = filteredOrders
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

    logMessages.push(`Price ${tokenSymbol}: ${currentPrice}`);

    logMessages.push(`Total ${tokenSymbol}: ${totalTokens}`);
    logMessages.push(`Value USD: ${parseFloat(totalTokens) * currentPrice}`);

    logMessages.push(`Count ${tokenSymbol} Vaults: ${totalInputsVaults.length + totalOutputsVaults.length}`);
  }

  return logMessages;
}

export async function volumeMetrics(network: string, filteredOrders: any[]): Promise<any> {

  const endpoint = networkConfig[network].subgraphUrl;
  const { totalTrades, tradesLast24Hours, tradesLastWeek, aggregatedResults, processOrderLogMessage } = await processOrdersWithAggregation(endpoint, filteredOrders);

  return { totalTrades, tradesLast24Hours, tradesLastWeek, aggregatedResults, processOrderLogMessage }
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

function calculateVolumes(trades: any[], currentTimestamp: number) {
  const tokenVolumes: Record<
    string,
    {
      inVolume24h: ethers.BigNumber;
      outVolume24h: ethers.BigNumber;
      inVolumeWeek: ethers.BigNumber;
      outVolumeWeek: ethers.BigNumber;
      inVolumeAllTime: ethers.BigNumber;
      outVolumeAllTime: ethers.BigNumber;
      decimals: number;
      address: string;
      symbol: string
    }
  > = {};

  const oneDayInSeconds = 24 * 60 * 60;
  const oneWeekInSeconds = 7 * 24 * 60 * 60;

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
          inVolume24h: ethers.BigNumber.from(0),
          outVolume24h: ethers.BigNumber.from(0),
          inVolumeWeek: ethers.BigNumber.from(0),
          outVolumeWeek: ethers.BigNumber.from(0),
          inVolumeAllTime: ethers.BigNumber.from(0),
          outVolumeAllTime: ethers.BigNumber.from(0),
          decimals: parseInt(token.decimals),
          address: token.address,
          symbol: token.symbol
        };
      }
    };

    initializeToken(inputToken);
    initializeToken(outputToken);

    // Add to all-time volumes
    tokenVolumes[inputToken.address].inVolumeAllTime = tokenVolumes[inputToken.address].inVolumeAllTime.add(inputAmount);
    tokenVolumes[outputToken.address].outVolumeAllTime = tokenVolumes[outputToken.address].outVolumeAllTime.add(outputAmount);

    // Add to 24-hour volumes
    if (timeDiff <= oneDayInSeconds) {
      tokenVolumes[inputToken.address].inVolume24h = tokenVolumes[inputToken.address].inVolume24h.add(inputAmount);
      tokenVolumes[outputToken.address].outVolume24h = tokenVolumes[outputToken.address].outVolume24h.add(outputAmount);
    }

    // Add to 1-week volumes
    if (timeDiff <= oneWeekInSeconds) {
      tokenVolumes[inputToken.address].inVolumeWeek = tokenVolumes[inputToken.address].inVolumeWeek.add(inputAmount);
      tokenVolumes[outputToken.address].outVolumeWeek = tokenVolumes[outputToken.address].outVolumeWeek.add(outputAmount);
    }
  });

  // Format volumes
  return Object.entries(tokenVolumes).map(([tokenAddress, data]) => {
    const { inVolume24h, outVolume24h, inVolumeWeek, outVolumeWeek, inVolumeAllTime, outVolumeAllTime, decimals, address, symbol } = data;

    const totalVolume24h = inVolume24h.add(outVolume24h);
    const totalVolumeWeek = inVolumeWeek.add(outVolumeWeek);
    const totalVolumeAllTime = inVolumeAllTime.add(outVolumeAllTime);

    return {
      token: symbol,
      decimals: decimals,
      address: address,
      inVolume24h: ethers.utils.formatUnits(inVolume24h, decimals),
      outVolume24h: ethers.utils.formatUnits(outVolume24h, decimals),
      totalVolume24h: ethers.utils.formatUnits(totalVolume24h, decimals),
      inVolumeWeek: ethers.utils.formatUnits(inVolumeWeek, decimals),
      outVolumeWeek: ethers.utils.formatUnits(outVolumeWeek, decimals),
      totalVolumeWeek: ethers.utils.formatUnits(totalVolumeWeek, decimals),
      inVolumeAllTime: ethers.utils.formatUnits(inVolumeAllTime, decimals),
      outVolumeAllTime: ethers.utils.formatUnits(outVolumeAllTime, decimals),
      totalVolumeAllTime: ethers.utils.formatUnits(totalVolumeAllTime, decimals),
    };
  });
}

async function processOrdersWithAggregation(endpoint: string, filteredOrders: any[]): Promise<{totalTrades: number, tradesLast24Hours: number, tradesLastWeek: number, aggregatedResults: any[]; processOrderLogMessage: string[] }> {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const aggregatedVolumes: Record<string, { total24h: ethers.BigNumber; totalWeek: ethers.BigNumber; totalAllTime: ethers.BigNumber; decimals: number; address: string, symbol: string }> = {};

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
      const volumes = calculateVolumes(trades, currentTimestamp);

      // Aggregate token volumes
      volumes.forEach(volume => {
        const token = volume.token;
        const decimals = volume.decimals;
        const address = volume.address;

        if (!aggregatedVolumes[address]) {
          aggregatedVolumes[address] = {
            total24h: ethers.BigNumber.from(0),
            totalWeek: ethers.BigNumber.from(0),
            totalAllTime: ethers.BigNumber.from(0),
            decimals: decimals,
            address,
            symbol: token
          };
        }

        aggregatedVolumes[address].total24h = aggregatedVolumes[address].total24h.add(ethers.utils.parseUnits(volume.totalVolume24h, decimals));
        aggregatedVolumes[address].totalWeek = aggregatedVolumes[address].totalWeek.add(ethers.utils.parseUnits(volume.totalVolumeWeek, decimals));
        aggregatedVolumes[address].totalAllTime = aggregatedVolumes[address].totalAllTime.add(ethers.utils.parseUnits(volume.totalVolumeAllTime, decimals));
      });
    } catch (error) {
      console.error(`Error processing order ${orderHash}:`, error);
      processOrderLogMessage.push(`Error processing order ${orderHash}: ${error}`);
    }
  }

  const totalTrades = orderTrades.reduce((sum, order) => sum + order.trades.length, 0);
  const tradesLast24Hours = orderTrades
    .flatMap(order => order.trades)
    .filter(trade => new Date(Number(trade.timestamp) * 1000) >= last24Hours).length;

  const tradesLastWeek = orderTrades
    .flatMap(order => order.trades)
    .filter(trade => new Date(Number(trade.timestamp) * 1000) >= lastWeek).length;

  const tradeDistribution = orderTrades.map(order => ({
    orderHash: order.orderHash,
    tradeCount: order.trades.length,
    tradePercentage: ((order.trades.length / totalTrades) * 100).toFixed(2),
  }));

  processOrderLogMessage.push(`Trade Metrics:`);
  processOrderLogMessage.push(`- Total Trades: ${totalTrades}`);
  processOrderLogMessage.push(`- Trades in Last 24 Hours: ${tradesLast24Hours}`);
  processOrderLogMessage.push(`- Trades in Last Week: ${tradesLastWeek}`);
  processOrderLogMessage.push(`- Trade Distribution by Order: ${JSON.stringify(tradeDistribution, null, 2)}`);

  // Format aggregated volumes for printing
  let aggregatedResults = Object.entries(aggregatedVolumes).map(([address, data]) => ({
    token: data.symbol,
    address: data.address,
    decimals: data.decimals,
    symbol: data.symbol,
    total24h: ethers.utils.formatUnits(data.total24h, data.decimals),
    totalWeek: ethers.utils.formatUnits(data.totalWeek, data.decimals),
    totalAllTime: ethers.utils.formatUnits(data.totalAllTime, data.decimals),
    total24hUsd: 0,
    totalWeekUsd: 0,
    totalAllTimeUsd: 0,
    currentPrice: 0
  }));

  aggregatedResults = await convertVolumesToUSD(aggregatedResults);

  // Add aggregated volume metrics to processOrderLogMessage
  processOrderLogMessage.push(`Raindex Volume by Token and Total:`);
  aggregatedResults.forEach(entry => {
    processOrderLogMessage.push(`- **Token**: ${entry.token} - ${entry.address}`);
    processOrderLogMessage.push(`  - **Symbol**: ${entry.symbol}`);
    processOrderLogMessage.push(`  - **${entry.symbol} Currnet price**: ${entry.currentPrice} USD`);

    processOrderLogMessage.push(`  - **24h Volume**: ${entry.total24h} ${entry.symbol}`);
    processOrderLogMessage.push(`  - **Week Volume**: ${entry.totalWeek} ${entry.symbol}`);
    processOrderLogMessage.push(`  - **All Time Volume**: ${entry.totalAllTime} ${entry.symbol}`);
    processOrderLogMessage.push(`  - **24h Volume (USD)**: ${entry.total24hUsd} USD`);
    processOrderLogMessage.push(`  - **Week Volume (USD)**: ${entry.totalWeekUsd} USD`);
    processOrderLogMessage.push(`  - **All Time Volume (USD)**: ${entry.totalAllTimeUsd} USD`);
  });

  return { totalTrades, tradesLast24Hours, tradesLastWeek, aggregatedResults, processOrderLogMessage };
}

async function convertVolumesToUSD(data: any[]): Promise<any[]> {
  for (const item of data) {
    if (item.token && item.address) {
      const tokenAddress = item.address;

      // Fetch the current price of the token
      const {averagePrice, currentPrice} = await getTokenPriceUsd(tokenAddress);

      if (currentPrice > 0) {
        // Convert total volumes to USD
        item.total24hUsd = (parseFloat(item.total24h) * currentPrice).toString();
        item.totalWeekUsd = (parseFloat(item.totalWeek) * currentPrice).toString();
        item.totalAllTimeUsd = (parseFloat(item.totalAllTime) * currentPrice).toString();
        item.currentPrice = (parseFloat(currentPrice.toString())).toString();


      } else {
        console.warn(`Could not fetch price for token ${tokenAddress}. Skipping USD conversion.`);
        item.total24hUsd = 0;
        item.totalWeekUsd = 0;
        item.totalAllTimeUsd = 0;
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
        poolQuoteTokenLiquidity: `${pair.liquidity.quote} ${pair.quoteToken.symbol}`
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching liquidity data:', error);
    throw error;
  }
}

export async function analyzeLiquidity(
  tokenAddress: string
): Promise<any> {
  const liquidityData = await fetchLiquidityData(tokenAddress);

  // Calculate total volumes and trades across all pools
  const totalPoolVolume = liquidityData.reduce((sum, pool) => sum + pool.volume24h, 0);
  const totalPoolTrades = liquidityData.reduce((sum, pool) => sum + pool.trades24h, 0);

  // Generate results
  const liquidityDataAggregated = liquidityData.map((pool: LiquidityPool) => {
    return {
      dex: pool.dex,
      pairAddress: pool.pairAddress,
      totalPoolVolume: pool.volume24h.toFixed(2),
      totalPoolTrades: pool.trades24h,
      totalPoolSizeUsd: pool.poolSizeUsd,
      poolBaseTokenLiquidity: pool.poolBaseTokenLiquidity,
      poolQuoteTokenLiquidity: pool.poolQuoteTokenLiquidity
    };
  });

  return {
    totalPoolVolume,
    totalPoolTrades,
    liquidityDataAggregated
  };
}
