import { ethers } from "ethers";
import { getTokenPriceUsd } from "../priceUtils";
import { tokenConfig, networkConfig } from "../config";
import { Block } from "../types";

import axios from "axios";

export async function analyzeLiquidity(
    network: string,
    token: string,
    fromTimestamp: number,
    toTimestamp: number,
): Promise<any> {
    const { symbol: tokenSymbol } = tokenConfig[token];
    const liquidityAnalysisLog: string[] = [];
    liquidityAnalysisLog.push(`Liquidity Analysis for ${tokenSymbol}:`);

    const { tradesAccordingToTimeStamp, totalPoolVolumeUsdForDuration, totalPoolTradesForDuration } =
        await analyzeHyperSyncData(
            tokenConfig[token],
            networkConfig[network],
            fromTimestamp,
            toTimestamp,
        );

    liquidityAnalysisLog.push(` - Pool Volume for duration: ${totalPoolVolumeUsdForDuration} USD`);
    liquidityAnalysisLog.push(` - Pool Trades for duration: ${totalPoolTradesForDuration}`);

    return {
        tradesAccordingToTimeStamp,
        liquidityAnalysisLog,
        totalTokenExternalVolForDurationUsd: totalPoolVolumeUsdForDuration,
        totalTokenExternalTradesForDuration: totalPoolTradesForDuration,
    };
}

async function getBlockNumberForTimestampByBlockTime(
    network: { chainId: number; rpc: string; blockTime: number },
    targetTimestamp: number,
): Promise<number> {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const diff = currentTimestamp - targetTimestamp;

    const provider = new ethers.providers.JsonRpcProvider(network.rpc);

    // Fetch the latest block
    const latestBlock = await provider.getBlock("latest");
    const latestBlockNumber = latestBlock.number;

    const approxNearBlock = latestBlockNumber - Math.floor(diff / network.blockTime);

    // Query Hypersync for blocks
    const queryResponse = await axios.post(`https://${network.chainId}.hypersync.xyz/query`, {
        from_block: approxNearBlock,
        include_all_blocks: true,
        field_selection: {
            block: ["number", "timestamp"],
        },
    });

    // Parse and normalize block data
    const allBlocks: Block[] = queryResponse.data.data.flatMap((item: any) =>
        item.blocks.map((block: any) => ({
            number: block.number,
            timestamp: parseInt(block.timestamp, 16),
        })),
    );

    // Binary search to find the nearest block
    const findNearestBlock = (blocks: Block[], targetTimestamp: number): Block => {
        let left = 0;
        let right = blocks.length - 1;
        let nearestBlock: Block | null = null;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midTimestamp = blocks[mid].timestamp;

            if (
                nearestBlock === null ||
                Math.abs(midTimestamp - targetTimestamp) <
                    Math.abs(nearestBlock.timestamp - targetTimestamp)
            ) {
                nearestBlock = blocks[mid];
            }

            if (midTimestamp < targetTimestamp) {
                left = mid + 1;
            } else if (midTimestamp > targetTimestamp) {
                right = mid - 1;
            } else {
                return blocks[mid]; // Exact match
            }
        }

        if (!nearestBlock) {
            throw new Error("No nearest block found.");
        }

        return nearestBlock;
    };

    const nearestBlock = findNearestBlock(allBlocks, targetTimestamp);

    return nearestBlock.number;
}

async function getBlockNumberForTimestampByHyperSync(
    network: { chainId: number; rpc: string },
    targetTimestamp: number,
) {
    const HYPERSYNC_URL = `https://${network.chainId}.hypersync.xyz/query`;

    try {
        // Get the latest block number
        const provider = new ethers.providers.JsonRpcProvider(network.rpc);
        const latestBlock = await provider.getBlock("latest");
        const latestBlockNumber = latestBlock.number;

        let left = 0;
        let right = latestBlockNumber;

        let closestBlock = null;
        let smallestDiff = Infinity;

        // Binary search loop
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);

            // Create Hypersync query for the mid block
            const query = {
                from_block: mid,
                to_block: mid + 1, // Exclusive upper bound
                logs: [{}], // Empty log selection for block data
                field_selection: {
                    block: ["number", "timestamp"],
                },
            };

            try {
                // Fetch block data from Hypersync
                const response = await axios.post(HYPERSYNC_URL, query);
                const blocks = response.data.data.flatMap((item: any) => item.blocks);

                if (blocks.length === 0) {
                    console.warn(`No blocks found for mid=${mid}. Adjusting search range.`);
                    right = mid - 1;
                    continue;
                }

                const block = blocks[0];
                const blockTimestamp = parseInt(block.timestamp, 16); // Convert hex to integer

                // Calculate the difference from the target timestamp
                const diff = Math.abs(blockTimestamp - targetTimestamp);

                // Update closest block if this is a better match
                if (diff < smallestDiff) {
                    smallestDiff = diff;
                    closestBlock = block.number;
                }

                // Adjust binary search range
                if (blockTimestamp < targetTimestamp) {
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            } catch (error) {
                console.error(`Error fetching block data for block ${mid}:`, error);
                // Skip this block range and move backward
                right = mid - 1;
            }
        }

        if (closestBlock !== null) {
            return closestBlock;
        } else {
            throw new Error("No block found close to the target timestamp.");
        }
    } catch (error) {
        console.error("Error in getBlockAtTimestamp:", error);
        throw error;
    }
}

async function getBlockNumberForTimestamp(
    network: { chainId: number; rpc: string; blockTime: number },
    targetTimestamp: number,
) {
    if (network.chainId === 42161) {
        return getBlockNumberForTimestampByBlockTime(network, targetTimestamp);
    } else {
        return getBlockNumberForTimestampByHyperSync(network, targetTimestamp);
    }
}

async function analyzeHyperSyncData(
    token: any,
    network: any,
    fromTimestamp: number,
    toTimestamp: number,
) {
    // Create hypersync client using the mainnet hypersync endpoint
    const hyperSyncClinet = `https://${network.chainId}.hypersync.xyz/query`;

    const fromBlockNumber = await getBlockNumberForTimestamp(network, fromTimestamp);
    const toBlockNumber = await getBlockNumberForTimestamp(network, toTimestamp);

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

    let tradesAccordingToTimeStamp:any[] = []
    const { currentPrice: currentTokenPrice } = await getTokenPriceUsd(token.address, token.symbol);

    for (let i = 0; i < token.poolsV2.length; i++) {
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
            "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
            fromBlockNumber,
            toBlockNumber,
        );

        let totalAmount0 = ethers.BigNumber.from(0);
        let totalAmount1 = ethers.BigNumber.from(0);
        totalPoolTradesForDuration += swapQueryResult.length;

        for (let i = 0; i < swapQueryResult.length; i++) {
            const log = swapQueryResult[i]?.data;

            if (log !== undefined) {
                const logBytes = ethers.utils.arrayify(log);
                const decodedAmount = ethers.utils.defaultAbiCoder.decode(
                    ["uint256", "uint256", "uint256", "uint256"],
                    logBytes,
                );
                totalAmount0 = totalAmount0
                    .add(ethers.BigNumber.from(decodedAmount[0]))
                    .add(ethers.BigNumber.from(decodedAmount[2]));
                totalAmount1 = totalAmount1
                    .add(ethers.BigNumber.from(decodedAmount[1]))
                    .add(ethers.BigNumber.from(decodedAmount[3]));


                let tokenAmount = token0Address.toLowerCase() === token.address.toLowerCase() ? 
                ethers.utils.formatUnits(ethers.BigNumber.from(decodedAmount[0]).add(ethers.BigNumber.from(decodedAmount[2])),token0Decimals).toString():
                ethers.utils.formatUnits(ethers.BigNumber.from(decodedAmount[1]).add(ethers.BigNumber.from(decodedAmount[3])),token1Decimals).toString()
            
                tradesAccordingToTimeStamp.push({
                    timestamp: swapQueryResult[i].timestamp,
                    transactionHash: swapQueryResult[i].transaction_hash,
                    amountInTokens: tokenAmount,
                    amountInUsd: parseFloat(tokenAmount) * currentTokenPrice
                })
            } else {
                console.error("Hex string is undefined!");
            }
        }

        const totalAmount0Formated = parseFloat(
            ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals),
        );
        const totalAmount1Formated = parseFloat(
            ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals),
        );

        if (totalVolumeForTokens[token0Address.toLowerCase()]) {
            totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration +=
                totalAmount0Formated;
        } else {
            totalVolumeForTokens[token0Address.toLowerCase()] = {
                totalTokenVolumeForDuration: totalAmount0Formated,
            };
        }

        if (totalVolumeForTokens[token1Address.toLowerCase()]) {
            totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration +=
                totalAmount1Formated;
        } else {
            totalVolumeForTokens[token1Address.toLowerCase()] = {
                totalTokenVolumeForDuration: totalAmount1Formated,
            };
        }
    }

    for (let i = 0; i < token.poolsV3.length; i++) {
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
            "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
            fromBlockNumber,
            toBlockNumber,
        );

        totalPoolTradesForDuration += swapQueryResult.length;
        for (let i = 0; i < swapQueryResult.length; i++) {
            const log = swapQueryResult[i]?.data;

            if (log !== undefined) {
                const logBytes = ethers.utils.arrayify(log);
                const decodedAmount = ethers.utils.defaultAbiCoder.decode(
                    ["int256", "int256", "uint160", "uint128", "int24"],
                    logBytes,
                );
                totalAmount0 = totalAmount0.add(ethers.BigNumber.from(decodedAmount[0]).abs());
                totalAmount1 = totalAmount1.add(ethers.BigNumber.from(decodedAmount[1]).abs());

                let tokenAmount = token0Address.toLowerCase() === token.address.toLowerCase() ? 
                ethers.utils.formatUnits(ethers.BigNumber.from(decodedAmount[0]).abs(),token0Decimals).toString():
                ethers.utils.formatUnits(ethers.BigNumber.from(decodedAmount[1]).abs(),token1Decimals).toString()
            
                tradesAccordingToTimeStamp.push({
                    timestamp: swapQueryResult[i].timestamp,
                    transactionHash: swapQueryResult[i].transaction_hash,
                    amountInTokens: tokenAmount,
                    amountInUsd: parseFloat(tokenAmount) * currentTokenPrice
                })
            } else {
                console.error("Hex string is undefined!");
            }
        }

        const totalAmount0Formated = parseFloat(
            ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals),
        );
        const totalAmount1Formated = parseFloat(
            ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals),
        );

        if (totalVolumeForTokens[token0Address.toLowerCase()]) {
            totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration +=
                totalAmount0Formated;
        } else {
            totalVolumeForTokens[token0Address.toLowerCase()] = {
                totalTokenVolumeForDuration: totalAmount0Formated,
            };
        }

        if (totalVolumeForTokens[token1Address.toLowerCase()]) {
            totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration +=
                totalAmount1Formated;
        } else {
            totalVolumeForTokens[token1Address.toLowerCase()] = {
                totalTokenVolumeForDuration: totalAmount1Formated,
            };
        }
    }

    for (let i = 0; i < token.poolsPancakSwapV3.length; i++) {
        const poolContractAddress = token.poolsPancakSwapV3[i];
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
            "0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83",
            fromBlockNumber,
            toBlockNumber,
        );

        totalPoolTradesForDuration += swapQueryResult.length;
        for (let i = 0; i < swapQueryResult.length; i++) {
            const log = swapQueryResult[i]?.data;

            if (log !== undefined) {
                const logBytes = ethers.utils.arrayify(log);
                const decodedAmount = ethers.utils.defaultAbiCoder.decode(
                    ["int256", "int256", "uint160", "uint128", "int24", "uint128", "uint128"],
                    logBytes,
                );
                totalAmount0 = totalAmount0.add(ethers.BigNumber.from(decodedAmount[0]).abs());
                totalAmount1 = totalAmount1.add(ethers.BigNumber.from(decodedAmount[1]).abs());

                let tokenAmount = token0Address.toLowerCase() === token.address.toLowerCase() ? 
                ethers.utils.formatUnits(ethers.BigNumber.from(decodedAmount[0]).abs(),token0Decimals).toString():
                ethers.utils.formatUnits(ethers.BigNumber.from(decodedAmount[1]).abs(),token1Decimals).toString()
            
                tradesAccordingToTimeStamp.push({
                    timestamp: swapQueryResult[i].timestamp,
                    transactionHash: swapQueryResult[i].transaction_hash,
                    amountInTokens: tokenAmount,
                    amountInUsd: parseFloat(tokenAmount) * currentTokenPrice
                })
            } else {
                console.error("Hex string is undefined!");
            }
        }

        const totalAmount0Formated = parseFloat(
            ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals),
        );
        const totalAmount1Formated = parseFloat(
            ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals),
        );

        if (totalVolumeForTokens[token0Address.toLowerCase()]) {
            totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration +=
                totalAmount0Formated;
        } else {
            totalVolumeForTokens[token0Address.toLowerCase()] = {
                totalTokenVolumeForDuration: totalAmount0Formated,
            };
        }

        if (totalVolumeForTokens[token1Address.toLowerCase()]) {
            totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration +=
                totalAmount1Formated;
        } else {
            totalVolumeForTokens[token1Address.toLowerCase()] = {
                totalTokenVolumeForDuration: totalAmount1Formated,
            };
        }
    }
    const totalPoolVolumeUsdForDuration =
        totalVolumeForTokens[token.address.toLowerCase()].totalTokenVolumeForDuration *
        currentTokenPrice;

    return { tradesAccordingToTimeStamp, totalPoolVolumeUsdForDuration, totalPoolTradesForDuration };
}

async function fetchLogs(
    client: any,
    poolContract: string,
    eventTopic: string,
    startBlock: number,
    endBlock: number,
): Promise<Array<any>> {
    let currentBlock = startBlock;
    let logs: Array<any> = [];

    while (currentBlock <= endBlock) {
        try {
            const queryResponse = await axios.post(client, {
                from_block: currentBlock,
                logs: [
                    {
                        address: [poolContract],
                        topics: [[eventTopic]],
                    },
                ],
                field_selection: {
                    log: [
                        "block_number",
                        "log_index",
                        "transaction_index",
                        "transaction_hash",
                        "data",
                        "address",
                        "topic0"
                    ],
                    block: [
                        "number",
                        "timestamp"
                    ]
                },
            });

            // Concatenate logs if there are any
            if (
                queryResponse.data.data &&
                queryResponse.data.data.length > 0 &&
                currentBlock != queryResponse.data.next_block
            ) {
                logs = logs.concat(queryResponse.data.data);
            }

            // Update currentBlock for the next iteration
            currentBlock = queryResponse.data.next_block;

            // Exit the loop if nextBlock is invalid
            if (!currentBlock || currentBlock > endBlock) {
                break;
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
            break; // Exit loop on error
        }
    }

    return logs.flatMap((entry) => {
        // Create a map of block_number to timestamp
        const blockMap = new Map(entry.blocks.map((block: any) => [block.number, parseInt(block.timestamp, 16)]));
      
        // Map each log with the corresponding timestamp
        return entry.logs.map((log: any) => ({
          ...log,
          timestamp: blockMap.get(log.block_number) || null, // Add timestamp if available
        }));
      });
}