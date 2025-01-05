import axios from "axios";
import * as dotenv from "dotenv";
import { Variables, Order } from "./types";
import { fetchOrderQuery } from "./queries";
import {
    tokenConfig,
    networkConfig,
    allowedNetworks,
    allowedTokens,
    allowedDurations,
} from "./config";
import {
    orderMetrics,
    tokenMetrics,
    calculateCombinedVaultBalance,
} from "./metrics/orderAndTokenMetreics";
import { volumeMetrics } from "./metrics/volumeMetrics";
import { analyzeLiquidity } from "./metrics/analyzeLiquidity";

import { Command } from "commander";

dotenv.config();
const openaiToken = process.env.OPENAI_API_KEY as string;

// Fetch All Orders for Tokens
async function fetchAndFilterOrders(
    token: string,
    network: string,
    skip = 0,
    first = 1000,
): Promise<{ filteredActiveOrders: Order[]; filteredInActiveOrders: Order[] }> {
    const variables: Variables = { skip, first };
    const endpoint = networkConfig[network].subgraphUrl;

    try {
        const response = await axios.post(endpoint, {
            query: fetchOrderQuery,
            variables,
        });

        const orders: Order[] = response.data.data.orders;
        const activeOrders = orders.filter((order) => order.active);
        const inActiveOrders = orders.filter((order) => !order.active);

        const {
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            address: tokenAddress,
        } = tokenConfig[token];

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
async function generateMarkdownReport(input: string): Promise<string> {
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
                Authorization: `Bearer ${openaiToken}`,
            },
        },
    );

    return response.data.choices[0].message.content;
}

// Error handler
function handleError(error: any) {
    if (axios.isAxiosError(error)) {
        console.error("Axios Error:", error.response?.data || error.message);
    } else {
        console.error("Unexpected Error:", error);
    }
}

// Generate report for tokens.
async function generateReportForToken(token: string, network: string, duration: string) {
    try {
        // Convert duration to seconds
        const durationToSeconds: Record<string, number> = {
            daily: 24 * 60 * 60,
            weekly: 7 * 24 * 60 * 60,
            monthly: 30 * 24 * 60 * 60,
        };
        const durationInSeconds = durationToSeconds[duration] ?? 0;

        // Fetch and process orders
        const { filteredActiveOrders, filteredInActiveOrders } = await fetchAndFilterOrders(
            token,
            network,
        );
        const allOrders = filteredActiveOrders.concat(filteredInActiveOrders);

        // Fetch order metrics
        const orderMetricsLogs = await orderMetrics(filteredActiveOrders, filteredInActiveOrders);
        const tokenMetricsLogs = await tokenMetrics(filteredActiveOrders);
        const combinedBalance = await calculateCombinedVaultBalance(allOrders);

        // Analyze liquidity
        const {
            liquidityAnalysisLog,
            totalTokenExternalVolForDurationUsd,
            totalTokenExternalTradesForDuration,
        } = await analyzeLiquidity(network, token, durationInSeconds);

        // Calculate volume metrics
        const {
            tradesLastForDuration: totalRaindexTradesForDuration,
            aggregatedResults,
            processOrderLogMessage,
        } = await volumeMetrics(network, allOrders, durationInSeconds);

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
        const formattedMarkdown = await generateMarkdownReport(markdownInput);
        console.log(formattedMarkdown);
    } catch (error) {
        handleError(error);
    }
}

const cliCommand = new Command();

cliCommand
    .name("raindex-token-report")
    .description(
        "A CLI tool to generate reports on volume and trades with external liquidity as well as raindex trades.",
    )
    .option("-t, --token <symbol>", `Token symbol. Any of [${allowedTokens.join(", ")}]`)
    .option("-n, --network <name>", `Network name. Any of [${allowedNetworks.join(", ")}]`)
    .option("-d, --duration <duration>", `Duration. Any of [${allowedDurations.join(", ")}]`);

// Parse the arguments
cliCommand.parse(process.argv);

// Access parsed options
const options = cliCommand.opts<{
    token: string;
    network: string;
    duration: string;
}>();

const { token, network, duration } = options;
generateReportForToken(token, network, duration);
