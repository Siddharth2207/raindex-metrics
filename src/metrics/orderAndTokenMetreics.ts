import { ethers } from 'ethers';
import {getTokenPriceUsd} from '../priceUtils'

const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

/**
 * Analyzes order metrics, including total orders, unique owners, and recent activity.
 */
export async function orderMetrics(filteredActiveOrders: any[], filteredInActiveOrders: any[]): Promise<string[]> {
    // Calculate total counts for active and inactive orders
    const totalActiveOrders = filteredActiveOrders.length;
    const totalInActiveOrders = filteredInActiveOrders.length;
  
    // Combine active and inactive orders into a single array
    const allOrders: any[] = [...filteredActiveOrders, ...filteredInActiveOrders];
  
    // Calculate unique owners across all orders
    const uniqueOwners = new Set(allOrders.map(order => order.owner)).size;
  
    // Determine the most recent order date (timestamp) in ISO format
    const lastOrderDate = allOrders.length
      ? new Date(Math.max(...allOrders.map(order => Number(order.timestampAdded)))).toISOString()
      : null;
  
    // Filter orders added within specific time periods
    const ordersLast24Hours = allOrders.filter(order => new Date(Number(order.timestampAdded) * 1000) >= last24Hours);
    const ordersLastWeek = allOrders.filter(order => new Date(Number(order.timestampAdded) * 1000) >= lastWeek);
  
    // Calculate unique owners for orders in the last 24 hours and last week
    const uniqueOwnersLast24Hours = new Set(ordersLast24Hours.map(order => order.owner)).size;
    const uniqueOwnersLastWeek = new Set(ordersLastWeek.map(order => order.owner)).size;
  
    // Aggregate all metrics into readable log messages
    const logMessages: string[] = [
      `Total Active Orders: ${totalActiveOrders}`,
      `Total Inactive Orders: ${totalInActiveOrders}`,
      `Unique Owners: ${uniqueOwners}`,
      `Last Order Date: ${lastOrderDate || 'N/A'}`,
      `Orders added in the last 24 hours: ${ordersLast24Hours.length}`,
      `Orders added in the last week: ${ordersLastWeek.length}`,
      `Unique owners in the last 24 hours: ${uniqueOwnersLast24Hours}`,
      `Unique owners in the last week: ${uniqueOwnersLastWeek}`,
    ];
  
    return logMessages;
}

/**
 * Calculates the combined USD value of all vault balances from the given orders.
 */
export async function calculateCombinedVaultBalance(orders: any): Promise<number> {
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
  
/**
 * Generates token metrics from the given filtered active orders.
 */
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
  