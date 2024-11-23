import axios from 'axios';
import { ethers } from 'ethers';
import { tradeQuery } from './queries';
import { networkConfig } from './config';
import { LiquidityPool } from './types';


const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export async function orderMetrics(filteredOrders: any[]){
    const totalOrders = filteredOrders.length;
    const uniqueOwners = new Set(filteredOrders.map(order => order.owner)).size;
    const lastOrderDate = filteredOrders.length
        ? new Date(Math.max(
            ...filteredOrders.map(order => new Date(Number(order.timestampAdded)).getTime())
        ) * 1000).toISOString()
        : null;

    console.log('Total Active Orders:', totalOrders);
    console.log('Unique Owners:', uniqueOwners);
    console.log('Last Order Date:', lastOrderDate);

    

    const ordersLast24Hours = filteredOrders.filter(order =>
        new Date(Number(order.timestampAdded) * 1000) >= last24Hours
    );
    const ordersLastWeek = filteredOrders.filter(order =>
        new Date(Number(order.timestampAdded) * 1000) >= lastWeek
    );

    console.log("orders added in last 24 hrs : ", ordersLast24Hours.length)
    console.log("orders added in last week : ", ordersLastWeek.length)

    const uniqueOwnersLast24Hours = new Set(
        ordersLast24Hours.map(order => order.owner)
    ).size;
    const uniqueOwnersLastWeek = new Set(
        ordersLastWeek.map(order => order.owner)
    ).size;

    console.log("unique owner in last 24 hrs: ", uniqueOwnersLast24Hours)
    console.log("unique owner in last week: ", uniqueOwnersLastWeek)
}

export async function tokenMetrics(filteredOrders: any[], tokensArray: any[]){

    for (const token of tokensArray) {
      const {symbol: tokenSymbol , decimals: tokenDecimals, address: tokenAddress} = token;

      const uniqueEntries = new Set<string>();

      const totalInputs = filteredOrders
          .flatMap(order => order.inputs)
          .filter(input => input.token.address === tokenAddress)
          .reduce((sum, input) => {
              const uniqueKey = input.id;
              uniqueEntries.add(uniqueKey); // Track all inputs
              return sum.add(ethers.BigNumber.from(input.balance));
          }, ethers.BigNumber.from(0));

      const totalOutputs = filteredOrders
          .flatMap(order => order.outputs)
          .filter(output => output.token.address === tokenAddress)
          .reduce((sum, output) => {
              const uniqueKey = output.id;
              if (!uniqueEntries.has(uniqueKey)) { // Only add if it's not already counted in inputs
                  uniqueEntries.add(uniqueKey);
                  return sum.add(ethers.BigNumber.from(output.balance));
              }
              return sum; // Skip duplicates
          }, ethers.BigNumber.from(0));

      const totalTokens = ethers.utils.formatUnits(totalInputs.add(totalOutputs), tokenDecimals);

      console.log(`Total ${tokenSymbol}: ${totalTokens}`);

    }
    
} 

export async function volumeMetrics(network: string, filteredOrders: any[]): Promise<any> {

  const endpoint = networkConfig[network].subgraphUrl;

  const totalTrades = filteredOrders.reduce((sum, order) => sum + order.trades.length, 0);
  const tradesLast24Hours = filteredOrders
    .flatMap(order => order.trades)
    .filter(trade => new Date(Number(trade.timestamp) * 1000) >= last24Hours).length;
  const tradesLastWeek = filteredOrders
    .flatMap(order => order.trades)
    .filter(trade => new Date(Number(trade.timestamp) * 1000) >= lastWeek).length;

  const tradeDistribution = filteredOrders.map(order => ({
    orderHash: order.orderHash,
    tradeCount: order.trades.length,
    tradePercentage: ((order.trades.length / totalTrades) * 100).toFixed(2),
  }));
  
  const aggregatedResult = await processOrdersWithAggregation(endpoint, filteredOrders);

  const total24hUsdSum = aggregatedResult.reduce((sum, item) => sum + parseFloat(item.total24hUsd), 0);

  return {aggregatedResult, total24hUsdSum, tradesLast24Hours}
  
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
        if (!tokenVolumes[token.symbol]) {
          tokenVolumes[token.symbol] = {
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
      tokenVolumes[inputToken.symbol].inVolumeAllTime = tokenVolumes[inputToken.symbol].inVolumeAllTime.add(inputAmount);
      tokenVolumes[outputToken.symbol].outVolumeAllTime = tokenVolumes[outputToken.symbol].outVolumeAllTime.add(outputAmount);
  
      // Add to 24-hour volumes
      if (timeDiff <= oneDayInSeconds) {
        tokenVolumes[inputToken.symbol].inVolume24h = tokenVolumes[inputToken.symbol].inVolume24h.add(inputAmount);
        tokenVolumes[outputToken.symbol].outVolume24h = tokenVolumes[outputToken.symbol].outVolume24h.add(outputAmount);
      }
  
      // Add to 1-week volumes
      if (timeDiff <= oneWeekInSeconds) {
        tokenVolumes[inputToken.symbol].inVolumeWeek = tokenVolumes[inputToken.symbol].inVolumeWeek.add(inputAmount);
        tokenVolumes[outputToken.symbol].outVolumeWeek = tokenVolumes[outputToken.symbol].outVolumeWeek.add(outputAmount);
      }
    });
  
    // Format volumes
    return Object.entries(tokenVolumes).map(([symbol, data]) => {
      const { inVolume24h, outVolume24h, inVolumeWeek, outVolumeWeek, inVolumeAllTime, outVolumeAllTime, decimals, address } = data;
  
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
  
async function processOrdersWithAggregation(endpoint: string, filteredOrders: any[]): Promise<any[]> {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const aggregatedVolumes: Record<string, { total24h: ethers.BigNumber; totalWeek: ethers.BigNumber; totalAllTime: ethers.BigNumber; decimals: number; address: string, symbol: string }> = {};
  
    for (const order of filteredOrders) {
      const orderHash = order.orderHash;
  
      try {
        // Fetch trades for the order
        const trades = await fetchTrades(endpoint, orderHash);
  
        // Calculate volumes for the trades
        const volumes = calculateVolumes(trades, currentTimestamp);
  
        // Aggregate token volumes
        volumes.forEach(volume => {
          const token = volume.token;
          const decimals = volume.decimals;
          const address = volume.address;
        
          if (!aggregatedVolumes[token]) {
            aggregatedVolumes[token] = {
              total24h: ethers.BigNumber.from(0),
              totalWeek: ethers.BigNumber.from(0),
              totalAllTime: ethers.BigNumber.from(0),
              decimals: decimals,
              address: address,
              symbol: token
            };
          }
  
          aggregatedVolumes[token].total24h = aggregatedVolumes[token].total24h.add(ethers.utils.parseUnits(volume.totalVolume24h, decimals));
          aggregatedVolumes[token].totalWeek = aggregatedVolumes[token].totalWeek.add(ethers.utils.parseUnits(volume.totalVolumeWeek, decimals));
          aggregatedVolumes[token].totalAllTime = aggregatedVolumes[token].totalAllTime.add(ethers.utils.parseUnits(volume.totalVolumeAllTime, decimals));
          

        });
      } catch (error) {
        console.error(`Error processing order ${orderHash}:`, error);
      }
    }
  
    // Format aggregated volumes for printing
    let aggregatedResults = Object.entries(aggregatedVolumes).map(([token, data]) => ({
      token,
      address: data.address,
      decimals: data.decimals,
      symbol: data.symbol,
      total24h: ethers.utils.formatUnits(data.total24h, data.decimals),
      totalWeek: ethers.utils.formatUnits(data.totalWeek, data.decimals),
      totalAllTime: ethers.utils.formatUnits(data.totalAllTime, data.decimals),
    }));

    aggregatedResults = await convertVolumesToUSD(aggregatedResults);

    return aggregatedResults

}

async function fetchTokenPriceFromDexScreener(tokenAddress: string, tokenSymbol: string): Promise<number> {
  try {
    const stablecoins = ["USDT", "USDC", "DAI", "BUSD"];
    if (stablecoins.some((stablecoin) => tokenSymbol.toUpperCase().includes(stablecoin))) {
      return 1; // Return 1 for stablecoins
    }
    
    const response = await axios.get(`https://api.dexscreener.io/latest/dex/search?q=${tokenAddress}`);
    const data = response.data;

    if (data && data.pairs && data.pairs.length > 0) {
      // Use the first matching pair for simplicity; refine logic if needed
      const price = data.pairs[0]?.priceUsd;
      return parseFloat(price) || 0;                   
    }

    return 0;
  } catch (error) {
    console.error(`Error fetching price from DexScreener for token ${tokenAddress}:`, error);
    return 0;
  }
}

async function convertVolumesToUSD(data: any[]): Promise<any[]> {
  for (const item of data) {
    if (item.token && item.address) {
      const tokenAddress = item.address;
      
      // Fetch the current price of the token
      const tokenPrice = await fetchTokenPriceFromDexScreener(tokenAddress, item.symbol);

      if (tokenPrice > 0) {
        // Convert total volumes to USD
        item.total24hUsd = (parseFloat(item.total24h) * tokenPrice).toString();
        item.totalWeekUsd = (parseFloat(item.totalWeek) * tokenPrice).toString(); 

      } else {
        console.warn(`Could not fetch price for token ${tokenAddress}. Skipping USD conversion.`);
        item.total24hUsd = 0;
        item.totalWeekUsd = 0;
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
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching liquidity data:', error);
    throw error;
  }
}

export async function analyzeLiquidity(
  tokenAddress: string,
  totalTradesInLast24: number,
  totalVolumeIn24h: number
) {
  const liquidityData = await fetchLiquidityData(tokenAddress);

  // Calculate total volumes and trades across all pools
  const totalPoolVolume = liquidityData.reduce((sum, pool) => sum + pool.volume24h, 0);
  const totalPoolTrades = liquidityData.reduce((sum, pool) => sum + pool.trades24h, 0);

  console.log("totalTradesInLast24 param : ", totalTradesInLast24)
  console.log("totalVolumeIn24h param : ", totalVolumeIn24h)
  console.log("totalPoolVolume param : ", totalPoolVolume)
  console.log("totalPoolTrades param : ", totalPoolTrades)



  // Generate results
  const results = liquidityData.map((pool: LiquidityPool) => {
    const volumeContribution = ((totalVolumeIn24h / totalPoolVolume) * 100).toFixed(2);
    const tradeContribution = ((totalTradesInLast24 / totalPoolTrades) * 100).toFixed(2);

    return {
      dex: pool.dex,
      pairAddress: pool.pairAddress,
      totalPoolVolume: pool.volume24h.toFixed(2),
      totalPoolTrades: pool.trades24h,
      volumeContribution: `${volumeContribution}%`,
      tradeContribution: `${tradeContribution}%`,
    };
  });

  console.log('Liquidity Pool Contribution:', results);
}