import { ethers } from "ethers";
import { getTokenPriceUsd } from "../priceUtils";
import { tokenConfig, networkConfig } from "../config";
import axios from "axios";

export async function analyzeLiquidity(
    network: string,
    token: string,
    durationInSeconds: number,
): Promise<any> {
    const {
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        address: tokenAddress,
    } = tokenConfig[token];
    const liquidityAnalysisLog: string[] = [];
    liquidityAnalysisLog.push(`Liquidity Analysis for ${tokenSymbol}:`);

    const { totalPoolVolumeUsdForDuration, totalPoolTradesForDuration } =
        await analyzeHyperSyncData(tokenConfig[token], networkConfig[network], durationInSeconds);

    liquidityAnalysisLog.push(` - Pool Volume for duration: ${totalPoolVolumeUsdForDuration} USD`);
    liquidityAnalysisLog.push(` - Pool Trades for duration: ${totalPoolTradesForDuration}`);

    return {
        liquidityAnalysisLog,
        totalTokenExternalVolForDurationUsd: totalPoolVolumeUsdForDuration,
        totalTokenExternalTradesForDuration: totalPoolTradesForDuration,
    };
}

async function getBlockNumberForTimePeriod(
    network: { rpc: string; blockTime: number },
    seconds: number,
) {
    try {
        // Validate the network object
        if (!network.rpc || !network.blockTime) {
            throw new Error('Invalid network object. Ensure "rpc" and "blockTime" are provided.');
        }

        if (seconds <= 0) {
            throw new Error("Invalid time period. Seconds must be greater than 0.");
        }

        // Initialize ethers provider
        const provider = new ethers.providers.JsonRpcProvider(network.rpc);

        // Fetch the latest block
        const latestBlock = await provider.getBlock("latest");
        const latestBlockNumber = latestBlock.number;
        const latestTimestamp = latestBlock.timestamp;

        // Calculate the target timestamp
        const targetTimestamp = latestTimestamp - seconds;

        // Perform binary search to find the exact block
        let low = 0;
        let high = latestBlockNumber;
        let closestBlock = latestBlockNumber;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midBlock = await provider.getBlock(mid);

            if (!midBlock) {
                throw new Error(`Failed to fetch block details for block number ${mid}.`);
            }

            const blockTimestamp = midBlock.timestamp;

            if (blockTimestamp === targetTimestamp) {
                closestBlock = mid;
                break;
            } else if (blockTimestamp < targetTimestamp) {
                low = mid + 1;
            } else {
                high = mid - 1;
                closestBlock = mid; // Update to the closest block above the target
            }
        }

        return { blockForPeriod: closestBlock, latestBlock: latestBlock.number };
    } catch (error) {
        console.error("Error calculating block number:", error);
        throw error;
    }
}

async function analyzeHyperSyncData(token: any, network: any, durationInSeconds: number) {
    // Create hypersync client using the mainnet hypersync endpoint
    const hyperSyncClinet = `https://${network.chainId}.hypersync.xyz/query`;

    const { blockForPeriod, latestBlock } = await getBlockNumberForTimePeriod(
        network,
        durationInSeconds,
    );

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
            blockForPeriod,
            latestBlock,
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
            blockForPeriod,
            latestBlock,
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
            blockForPeriod,
            latestBlock,
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

    const { currentPrice: currentTokenPrice } = await getTokenPriceUsd(token.address, token.symbol);

    const totalPoolVolumeUsdForDuration =
        totalVolumeForTokens[token.address.toLowerCase()].totalTokenVolumeForDuration *
        currentTokenPrice;

    return { totalPoolVolumeUsdForDuration, totalPoolTradesForDuration };
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
                        "topic0",
                        "topic1",
                        "topic2",
                        "topic3",
                    ],
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

    return Array.from(
        new Map(
            logs.flatMap((item) => item.logs).map((log) => [log.transaction_hash, log]),
        ).values()
    )

}
