import axios from "axios";
import { Order } from "./types";
import { fetchOrderQuery } from "./queries";
import { tokenConfig, networkConfig } from "./config";
import {
    orderMetrics,
    tokenMetrics,
    calculateCombinedVaultBalance,
} from "./metrics/orderAndTokenMetreics";
import { volumeMetrics, fetchAllPaginatedData } from "./metrics/volumeMetrics";
import { analyzeLiquidity } from "./metrics/analyzeLiquidity";

// Fetch All Orders for Tokens
export async function fetchAndFilterOrders(
    token: string,
    network: string,
): Promise<{ filteredActiveOrders: Order[]; filteredInActiveOrders: Order[] }> {
    const endpoint = networkConfig[network].subgraphUrl;

    try {
        
        const orders: Order[] = await fetchAllPaginatedData(endpoint, fetchOrderQuery, {}, "orders")
        const activeOrders = orders.filter((order) => order.active);
        const inActiveOrders = orders.filter((order) => !order.active);

        const { symbol: tokenSymbol, address: tokenAddress } = tokenConfig[token];

        console.log(`Fetching orders for token: ${tokenSymbol} on network: ${network}`);

        // Filter orders where inputs.token.symbol or outputs.token.symbol matches the specified token
        const filteredActiveOrders = activeOrders.filter(
            (order) =>
                order.inputs.some(
                    (input) =>
                        input.token.symbol === tokenSymbol && input.token.address === tokenAddress,
                ) ||
                order.outputs.some(
                    (output) =>
                        output.token.symbol === tokenSymbol &&
                        output.token.address === tokenAddress,
                ),
        );

        const filteredInActiveOrders = inActiveOrders.filter(
            (order) =>
                order.inputs.some(
                    (input) =>
                        input.token.symbol === tokenSymbol && input.token.address === tokenAddress,
                ) ||
                order.outputs.some(
                    (output) =>
                        output.token.symbol === tokenSymbol &&
                        output.token.address === tokenAddress,
                ),
        );

        return { filteredActiveOrders, filteredInActiveOrders };
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error fetching orders:", error.message);
        } else {
            console.error("Unexpected error:", JSON.stringify(error));
        }
        throw error;
    }
}

// Helper function to generate markdown report via OpenAI API
export async function generateMarkdownReport(input: string, openAiApiKey: string): Promise<string> {
    const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant that formats logs into professional markdown reports.",
                },
                {
                    role: "user",
                    content: `Please format the following content into a clean, professional markdown report:\n\n${input}`,
                },
            ],
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openAiApiKey}`,
            },
        },
    );

    return response.data.choices[0].message.content;
}

// Error handler
export function handleError(error: any) {
    console.error("Unexpected Error:", error);
}

// Generate report for tokens.
export async function generateReportForToken(
    token: string,
    network: string,
    duration: string,
    openAiApiKey: string,
) {
    try {
        // Convert duration to seconds
        const durationToSeconds: Record<string, number> = {
            daily: 24 * 60 * 60,
            weekly: 7 * 24 * 60 * 60,
            monthly: 30 * 24 * 60 * 60,
        };
        const durationInSeconds = durationToSeconds[duration] ?? 0;
        const gracePeriodInSeconds = 300;
        const toTimestamp = Math.floor(new Date().getTime() / 1000) - gracePeriodInSeconds;
        const fromTimestamp = toTimestamp - durationInSeconds;

        // Fetch and process orders
        const { filteredActiveOrders, filteredInActiveOrders } = await fetchAndFilterOrders(
            token,
            network,
        );
        const allOrders = filteredActiveOrders.concat(filteredInActiveOrders);

        // Fetch order metrics
        const { logMessages: orderMetricsLogs } = await orderMetrics(
            filteredActiveOrders,
            filteredInActiveOrders,
            fromTimestamp,
            toTimestamp,
        );
        const { logMessages: tokenMetricsLogs } = await tokenMetrics(filteredActiveOrders);
        const combinedBalance = await calculateCombinedVaultBalance(allOrders);

        // Analyze liquidity
        const {
            liquidityAnalysisLog,
            totalTokenExternalVolForDurationUsd,
            totalTokenExternalTradesForDuration,
        } = await analyzeLiquidity(network, token, fromTimestamp, toTimestamp);

        // Calculate volume metrics
        const {
            tradesLastForDuration: totalRaindexTradesForDuration,
            aggregatedResults,
            processOrderLogMessage,
        } = await volumeMetrics(network, allOrders, fromTimestamp, toTimestamp, token);

        // Calculate Raindex volume
        const tokenAddress = tokenConfig[token]?.address.toLowerCase();
        const totalRaindexVolumeUsd = Number(
            aggregatedResults?.find((e: any) => e.address.toLowerCase() === tokenAddress)
                ?.totalVolumeForDurationUsd || 0,
        );

        // Generate insights
        const totalExternalTrades =
            totalTokenExternalTradesForDuration - totalRaindexTradesForDuration;
        const totalExternalVolumeUsd = totalTokenExternalVolForDurationUsd - totalRaindexVolumeUsd;

        const summarizedMessage = `
      Insight 1:
      Total Raindex trades (${duration}): ${totalRaindexTradesForDuration}
      Total external trades (${duration}): ${totalExternalTrades}
      Total trades (${duration}): ${totalTokenExternalTradesForDuration}
      Total Raindex token volume (${duration}): ${totalRaindexVolumeUsd.toFixed(2)}
      Total external volume (${duration}): ${totalExternalVolumeUsd.toFixed(2)}
      Total volume (${duration}): ${totalTokenExternalVolForDurationUsd.toFixed(2)}
      Raindex trades as a % of total trades: ${((totalRaindexTradesForDuration / totalTokenExternalTradesForDuration) * 100).toFixed(2)}%
      Raindex volume as a % of total volume: ${((totalRaindexVolumeUsd / totalTokenExternalVolForDurationUsd) * 100).toFixed(2)}%

      Insight 2:
      Current value of vault balances in USD: ${combinedBalance.toFixed(2)}
      Raindex daily volume as a % of vault balance: ${((totalRaindexVolumeUsd / combinedBalance) * 100).toFixed(2)}%
    `;

        // Markdown input
        const markdownInput = `
# Network Analysis for ${network.toUpperCase()} - ${token.toUpperCase()}
# From: ${new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleString()}
# To: ${new Date().toLocaleString()}

## Raindex Order Metrics
\`\`\`
${orderMetricsLogs.join("\n")}
\`\`\`

## Raindex Vaults by Token
\`\`\`
${tokenMetricsLogs.join("\n")}
\`\`\`

## Raindex Trades by Order
\`\`\`
${processOrderLogMessage.join("\n")}
\`\`\`

## External Liquidity Analysis
\`\`\`
${liquidityAnalysisLog.join("\n")}
\`\`\`

## Summary
${summarizedMessage}
`;

        // Generate formatted markdown
        const formattedMarkdown = await generateMarkdownReport(markdownInput, openAiApiKey);
        console.log(formattedMarkdown);
    } catch (error) {
        handleError(error);
    }
}