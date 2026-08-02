#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface SteamAppDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: {
      type: string;
      name: string;
      steam_appid: number;
      short_description?: string;
      detailed_description?: string;
      header_image?: string;
      developers?: string[];
      publishers?: string[];
      platforms?: { windows: boolean; mac: boolean; linux: boolean };
      metacritic?: { score: number; url: string };
      categories?: { id: number; description: string }[];
      genres?: { id: string; description: string }[];
      release_date?: { coming_soon: boolean; date: string };
    };
  };
}

interface SteamReviewsResponse {
  success: number;
  query_summary?: {
    num_reviews: number;
    review_score: number;
    review_score_desc: string;
    total_positive: number;
    total_negative: number;
    total_reviews: number;
  };
}

interface SteamSearchResponse {
  total: number;
  items: Array<{
    id: number;
    name: string;
    tiny_image?: string;
    metascore?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Cache Setup (1-Hour TTL)
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 60 * 1000;
const apiCache = new Map<string, CacheEntry<unknown>>();

async function fetchWithCache<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Steam API HTTP error! status: ${response.status} (${response.statusText})`);
  }

  const contentType = response.headers.get("content-type") || "";
  let data: unknown;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  apiCache.set(url, { data, timestamp: Date.now() });
  return data as T;
}

// ---------------------------------------------------------------------------
// Data Normalization Helpers
// ---------------------------------------------------------------------------
function normalizeStoreDetails(appId: number, raw: SteamAppDetailsResponse) {
  const appData = raw[appId.toString()];
  if (!appData || !appData.success || !appData.data) {
    return { appId, found: false };
  }

  const d = appData.data;
  return {
    found: true,
    appId: d.steam_appid,
    name: d.name,
    type: d.type,
    shortDescription: d.short_description || "",
    headerImage: d.header_image || "",
    developers: d.developers || [],
    publishers: d.publishers || [],
    genres: d.genres?.map((g) => g.description) || [],
    categories: d.categories?.map((c) => c.description) || [],
    platforms: d.platforms || { windows: false, mac: false, linux: false },
    metacritic: d.metacritic ? { score: d.metacritic.score, url: d.metacritic.url } : null,
    releaseDate: d.release_date
      ? { date: d.release_date.date, comingSoon: d.release_date.coming_soon }
      : null,
  };
}

function normalizeReviews(appId: number, raw: SteamReviewsResponse) {
  if (!raw || raw.success !== 1 || !raw.query_summary) {
    return { appId, found: false };
  }

  const s = raw.query_summary;
  const total = s.total_reviews || 0;
  const positive = s.total_positive || 0;
  const positivePercentage = total > 0 ? Math.round((positive / total) * 1000) / 10 : 0;

  return {
    found: true,
    appId,
    reviewScoreDescription: s.review_score_desc || "No user reviews",
    totalReviews: total,
    totalPositive: positive,
    totalNegative: s.total_negative || 0,
    positivePercentage: `${positivePercentage}%`,
  };
}

// ---------------------------------------------------------------------------
// MCP Server Definition
// ---------------------------------------------------------------------------
const server = new Server(
  {
    name: "steam-storefront-mcp",
    version: "1.0.2",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_store",
        description:
          "Search the Steam Storefront for games matching a query string to get their Steam AppIDs.",
        inputSchema: {
          type: "object",
          properties: {
            term: {
              type: "string",
              description: "The search query (e.g. 'Elden Ring', 'Hades', 'Cyberpunk').",
            },
          },
          required: ["term"],
        },
      },
      {
        name: "get_store_details",
        description:
          "Get detailed Steam storefront metadata for a game (genres, categories, description, developers, metacritic, release date).",
        inputSchema: {
          type: "object",
          properties: {
            appId: {
              type: "number",
              description: "The numeric Steam AppID (e.g. 730 for CS2, 1245620 for Elden Ring).",
            },
          },
          required: ["appId"],
        },
      },
      {
        name: "get_app_reviews",
        description:
          "Get Steam player review summaries (review score rating e.g. 'Overwhelmingly Positive', total reviews, positive ratio).",
        inputSchema: {
          type: "object",
          properties: {
            appId: {
              type: "number",
              description: "The numeric Steam AppID.",
            },
          },
          required: ["appId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_store") {
      const term = String(args?.term || "");
      if (!term) throw new Error("Search term is required.");

      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
        term
      )}&l=english&cc=US`;
      const data = await fetchWithCache<SteamSearchResponse>(url);

      const items = (data.items || []).map((item) => ({
        appId: item.id,
        name: item.name,
        tinyImage: item.tiny_image || "",
        metascore: item.metascore || undefined,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ total: data.total || items.length, items }, null, 2),
          },
        ],
      };
    }

    if (name === "get_store_details") {
      const appId = Number(args?.appId);
      if (!appId || isNaN(appId)) throw new Error("Valid numeric appId is required.");

      const url = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
      const data = await fetchWithCache<SteamAppDetailsResponse>(url);
      const normalized = normalizeStoreDetails(appId, data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(normalized, null, 2),
          },
        ],
      };
    }

    if (name === "get_app_reviews") {
      const appId = Number(args?.appId);
      if (!appId || isNaN(appId)) throw new Error("Valid numeric appId is required.");

      const url = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all`;
      const data = await fetchWithCache<SteamReviewsResponse>(url);
      const normalized = normalizeReviews(appId, data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(normalized, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Steam Storefront MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error running Steam Storefront MCP Server:", error);
  process.exit(1);
});
