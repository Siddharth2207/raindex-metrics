const axios = require ("axios");
import { ethers } from "ethers";
import { getTokenPriceUsd } from "../priceUtils";
import { fetchTradesQuery } from "../queries";
import { tokenConfig, networkConfig } from "../config";

export async function volumeMetrics(
    network: string,
    filteredOrders: any[],
    durationInSeconds: number,
    token: string,
): Promise<any> {
    const endpoint = networkConfig[network].subgraphUrl;
    const { tradesLastForDuration, aggregatedResults, processOrderLogMessage } =
        await processOrdersWithAggregation(endpoint, filteredOrders, durationInSeconds, token);

    return { tradesLastForDuration, aggregatedResults, processOrderLogMessage };
}

async function fetchTrades(endpoint: string, orderHash: string): Promise<any[]> {
    try {
        const response = await axios.post(endpoint, {
            query: fetchTradesQuery,
            variables: { orderHash },
        });
        return response.data.data.trades || [];
    } catch (error) {
        console.error(`Error fetching trades for order ${orderHash}:`, error);
        throw error;
    }
}

async function processOrdersWithAggregation(
    endpoint: string,
    filteredOrders: any[],
    durationInSeconds: number,
    token: string,
): Promise<{
    tradesLastForDuration: number;
    aggregatedResults: any[];
    processOrderLogMessage: string[];
}> {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const aggregatedVolumes: Record<
        string,
        {
            totalVolumeForDuration: ethers.BigNumber;
            decimals: number;
            address: string;
            symbol: string;
        }
    > = {};

    const orderTrades = [];
    const processOrderLogMessage: string[] = [];

    for (const order of filteredOrders) {
        const orderHash = order.orderHash;

        try {
            // Fetch trades for the order
            const trades = await fetchTrades(endpoint, orderHash);

            orderTrades.push({
                orderHash: orderHash,
                trades: trades,
            });

            // Calculate volumes for the trades
            const volumes = calculateVolumes(trades, currentTimestamp, durationInSeconds);

            // Aggregate token volumes
            volumes.forEach((volume) => {
                const token = volume.token;
                const decimals = volume.decimals;
                const address = volume.address;

                if (!aggregatedVolumes[address]) {
                    aggregatedVolumes[address] = {
                        totalVolumeForDuration: ethers.BigNumber.from(0),
                        decimals: decimals,
                        address,
                        symbol: token,
                    };
                }

                aggregatedVolumes[address].totalVolumeForDuration = aggregatedVolumes[
                    address
                ].totalVolumeForDuration.add(
                    ethers.utils.parseUnits(volume.totalVolumeForDuration, decimals),
                );
            });
        } catch (error) {
            console.error(`Error processing order ${orderHash}:`, error);
            processOrderLogMessage.push(`Error processing order ${orderHash}: ${error}`);
        }
    }

    const totalTrades = orderTrades.reduce((sum, order) => sum + order.trades.length, 0);

    const tradesLastForDuration = orderTrades
        .flatMap((order) => order.trades)
        .filter(
            (trade) =>
                new Date(Number(trade.timestamp) * 1000) >=
                new Date(Date.now() - durationInSeconds * 1000),
        ).length;

    const { tradeDistributionForDuration, volumeDistributionForDuration } =
        await calculateTradeDistribution(orderTrades, durationInSeconds, token);

    let logString = "For Duration";
    if (durationInSeconds === 86400) {
        logString = "24 hours";
    } else if (durationInSeconds === 86400 * 7) {
        logString = "week";
    } else if (durationInSeconds === 86400 * 30) {
        logString = "month";
    }

    processOrderLogMessage.push(`Trade Metrics:`);
    processOrderLogMessage.push(`- Trades in last ${logString}: ${tradesLastForDuration}`);
    processOrderLogMessage.push(`- Total Historical Trades: ${totalTrades}`);
    processOrderLogMessage.push(
        `- Trade Distribution in ${logString} by Order: ${JSON.stringify(tradeDistributionForDuration, null, 2)}`,
    );
    processOrderLogMessage.push(
        `- Volume Distribution in ${logString} by Order: ${JSON.stringify(volumeDistributionForDuration, null, 2)}`,
    );

    // Format aggregated volumes for printing
    let aggregatedResults = Object.entries(aggregatedVolumes).map(([_, data]) => ({
        token: data.symbol,
        address: data.address,
        decimals: data.decimals,
        symbol: data.symbol,
        totalVolumeForDuration: ethers.utils.formatUnits(
            data.totalVolumeForDuration,
            data.decimals,
        ),
        totalVolumeForDurationUsd: 0,
        currentPrice: 0,
    }));

    aggregatedResults = await convertVolumesToUSD(aggregatedResults);

    // Add aggregated volume metrics to processOrderLogMessage
    processOrderLogMessage.push(`Raindex Volume by Token and Total:`);

    aggregatedResults.forEach((entry) => {
        processOrderLogMessage.push(`- **Token**: ${entry.token} - ${entry.address}`);
        processOrderLogMessage.push(`  - **Symbol**: ${entry.symbol}`);
        processOrderLogMessage.push(
            `  - **${entry.symbol} Currnet price**: ${entry.currentPrice} USD`,
        );
        processOrderLogMessage.push(
            `  - **${logString} Volume**: ${entry.totalVolumeForDuration} ${entry.symbol}`,
        );
        processOrderLogMessage.push(
            `  - **${logString} Volume (USD)**: ${entry.totalVolumeForDurationUsd} USD`,
        );
    });

    return { tradesLastForDuration, aggregatedResults, processOrderLogMessage };
}

async function calculateTradeDistribution(
    orderTrades: any[],
    durationInSeconds: number,
    token: string,
): Promise<{
    tradeDistributionForDuration: any[];
    volumeDistributionForDuration: any[];
}> {
    const orderTradesForDuration = orderTrades.map((order) => ({
        orderHash: order.orderHash,
        trades: order.trades.filter(
            (trade: any) =>
                new Date(Number(trade.timestamp) * 1000) >=
                new Date(Date.now() - durationInSeconds * 1000),
        ),
    }));

    const totalTradesForDuration = orderTradesForDuration.reduce(
        (sum, order) => sum + order.trades.length,
        0,
    );

    const tradeDistributionForDuration = orderTradesForDuration.map((order) => ({
        orderHash: order.orderHash,
        tradeCount: order.trades.length,
        tradePercentage: ((order.trades.length / totalTradesForDuration) * 100).toFixed(2),
    }));

    const { volumeDistributionForDuration } = await getVolumeDistribution(
        orderTradesForDuration,
        token,
    );

    return { tradeDistributionForDuration, volumeDistributionForDuration };
}

async function getVolumeDistribution(orderTradesDuration: any[], token: string) {
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
    const { address: tokenAddress } = tokenConfig[token];
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
                tokenVolumesPerOrder[orderHash][inputToken.address].inVolumeDuration.add(
                    inputAmount,
                );

            tokenVolumesPerOrder[orderHash][outputToken.address].outVolumeDuration =
                tokenVolumesPerOrder[orderHash][outputToken.address].outVolumeDuration.add(
                    outputAmount,
                );

            tokenVolumesPerOrder[orderHash][inputToken.address].totalVolumeDuration =
                tokenVolumesPerOrder[orderHash][inputToken.address].inVolumeDuration.add(
                    tokenVolumesPerOrder[orderHash][inputToken.address].outVolumeDuration,
                );

            tokenVolumesPerOrder[orderHash][outputToken.address].totalVolumeDuration =
                tokenVolumesPerOrder[orderHash][outputToken.address].inVolumeDuration.add(
                    tokenVolumesPerOrder[orderHash][outputToken.address].outVolumeDuration,
                );

            // Convert to USD using the current price
            tokenVolumesPerOrder[orderHash][inputToken.address].totalVolumeDurationUsd = (
                parseFloat(
                    ethers.utils.formatUnits(
                        tokenVolumesPerOrder[orderHash][inputToken.address].totalVolumeDuration,
                        tokenVolumesPerOrder[orderHash][inputToken.address].decimals,
                    ),
                ) * tokenVolumesPerOrder[orderHash][inputToken.address].currentPrice
            ).toFixed(2);

            tokenVolumesPerOrder[orderHash][outputToken.address].totalVolumeDurationUsd = (
                parseFloat(
                    ethers.utils.formatUnits(
                        tokenVolumesPerOrder[orderHash][outputToken.address].totalVolumeDuration,
                        tokenVolumesPerOrder[orderHash][outputToken.address].decimals,
                    ),
                ) * tokenVolumesPerOrder[orderHash][outputToken.address].currentPrice
            ).toFixed(2);
        }
    }

    // Calculate total volume (in USD) for all orders
    const totalVolumeUsd = Object.values(tokenVolumesPerOrder).reduce((total, tokens) => {
        return (
            total +
            Object.values(tokens)
                .filter((token: any) => {
                    return token.address.toLowerCase() === tokenAddress.toLowerCase();
                })
                .reduce((sum, token) => sum + parseFloat(token.totalVolumeDurationUsd), 0)
        );
    }, 0);

    // Calculate volume distribution for each order
    const volumeDistributionForDuration = Object.entries(tokenVolumesPerOrder).map(
        ([orderHash, tokens]) => {
            const orderTotalVolumeUsd = Object.values(tokens)
                .filter((token: any) => {
                    return token.address.toLowerCase() === tokenAddress.toLowerCase();
                })
                .reduce((sum, token) => sum + parseFloat(token.totalVolumeDurationUsd), 0);

            return {
                orderHash,
                totalVolumeUsd: orderTotalVolumeUsd.toFixed(2),
                volumePercentage: ((orderTotalVolumeUsd / totalVolumeUsd) * 100).toFixed(2),
            };
        },
    );

    return { volumeDistributionForDuration, tokenVolumesPerOrder };
}

function calculateVolumes(trades: any[], currentTimestamp: number, durationInSeconds: number) {
    const tokenVolumes: Record<
        string,
        {
            inVolumeForDuration: ethers.BigNumber;
            outVolumeForDuration: ethers.BigNumber;
            decimals: number;
            address: string;
            symbol: string;
        }
    > = {};

    trades.forEach((trade) => {
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
                    symbol: token.symbol,
                };
            }
        };

        initializeToken(inputToken);
        initializeToken(outputToken);

        if (timeDiff <= durationInSeconds) {
            tokenVolumes[inputToken.address].inVolumeForDuration =
                tokenVolumes[inputToken.address].inVolumeForDuration.add(inputAmount);
            tokenVolumes[outputToken.address].outVolumeForDuration =
                tokenVolumes[outputToken.address].outVolumeForDuration.add(outputAmount);
        }
    });

    // Format volumes
    return Object.entries(tokenVolumes).map(([_, data]) => {
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
            const { currentPrice } = await getTokenPriceUsd(
                tokenAddress,
                item.symbol,
            );

            if (currentPrice > 0) {
                item.totalVolumeForDurationUsd = (
                    parseFloat(item.totalVolumeForDuration) * currentPrice
                ).toString();
                item.currentPrice = parseFloat(currentPrice.toString()).toString();
            } else {
                console.warn(
                    `Could not fetch price for token ${tokenAddress}. Skipping USD conversion.`,
                );
                item.totalVolumeForDurationUsd = 0;
                item.currentPrice = 0;
            }
        }
    }

    return data;
}
