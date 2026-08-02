# steam-storefront-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives AI assistants access to public Steam Storefront metadata, official genres, categories, and player review sentiment via structured Steam JSON APIs.

Search for games on Steam, retrieve official store details, and analyze Steam player review ratings — all without needing a Steam API key.

---

## Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `search_store` | `term` (string) | Search Steam Storefront by game title query — returns matching games with AppIDs via structured JSON API. |
| `get_store_details` | `appId` (number) | Get official store metadata (genres, categories, short/detailed description, developers, publishers, metacritic score, platforms, release date). |
| `get_app_reviews` | `appId` (number) | Get Steam player review statistics (positive review percentage, total review count, rating score string e.g. `"Overwhelmingly Positive"`). |

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- **No API keys or Steam account required** — this server uses public Steam Storefront endpoints.

---

## Installation & Configuration

### Option A — npx (Recommended, no install required)

Add the following to your MCP client config file:

```json
{
  "mcpServers": {
    "steam-storefront": {
      "command": "npx",
      "args": ["-y", "steam-storefront-mcp"]
    }
  }
}
```

### Option B — Clone and build locally

```bash
git clone https://github.com/brandikun/steam-storefront-mcp.git
cd steam-storefront-mcp
npm install
npm run build
```

Then add to your MCP config:

```json
{
  "mcpServers": {
    "steam-storefront": {
      "command": "node",
      "args": ["/absolute/path/to/steam-storefront-mcp/dist/index.js"]
    }
  }
}
```

---

## MCP Client Config Locations

| Client | Config File Location |
|--------|----------------------|
| **Antigravity / AGY** | `~/.gemini/antigravity-cli/settings.json` or `mcp_config.json` |
| **Claude Desktop (macOS)** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Claude Desktop (Windows)** | `%APPDATA%\Claude\claude_desktop_config.json` |

---

## Example Usage

Once connected, you can ask your AI assistant questions like:

- *"What is the Steam review consensus for Vampire Crawlers?"*
- *"Search Steam for Elden Ring to get its AppID"*
- *"Find out if Hades II supports full controller support, co-op, and Steam Deck"*

---

## Performance & Caching

| Feature | Details |
|---------|---------|
| **In-Memory Cache** | All Steam Storefront API and store page requests are cached in memory for **1 hour (3600s)**. |
| **Rate Limit Protection** | Repeated lookups for the same game use 0 network requests. |

---

## License

MIT
