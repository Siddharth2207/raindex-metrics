const axios = require("axios");
import { TokenPrice } from "./types";

/**
 * Fetches the USD price for a given token, considering special cases and 24-hour price changes.
 */
export async function getTokenPriceUsd(
    tokenAddress: string,
    tokenSymbol: string,
): Promise<TokenPrice> {
    try {
        if (tokenSymbol.includes("USD")) {
            return {
                averagePrice: 1,
                currentPrice: 1,
            };
        }
        const response = await axios.get(
            `https://api.dexscreener.io/latest/dex/search?q=${tokenAddress}`,
        );

        const pairs = response.data?.pairs || [];
        if (pairs.length === 0) {
            console.warn(`No pairs found for token ${tokenAddress}`);
            return { averagePrice: 0, currentPrice: 0 };
        }

        let currentPrice = 0;
        let averagePrice = 0;

        // Handle WFLR special case
        if (tokenAddress.toLowerCase() === "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d") {
            const specialPair = pairs.find(
                (pair: any) =>
                    pair.baseToken.address.toLowerCase() ===
                        "0xfbda5f676cb37624f28265a144a48b0d6e87d3b6".toLowerCase() &&
                    pair.quoteToken.address.toLowerCase() ===
                        "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d".toLowerCase(),
            );

            if (specialPair) {
                currentPrice = 1 / parseFloat(specialPair.priceNative) || 0;

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
    } catch (error) {
        console.error(`Unexpected error fetching price for token ${tokenAddress}:`, error);
        return { averagePrice: 0, currentPrice: 0 };
    }
}
