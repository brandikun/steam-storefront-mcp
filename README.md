# steam-storefront-mcp

Model Context Protocol (MCP) server for querying public Steam Storefront metadata, user tags, genres, categories, and player review sentiment.

## Features

- **`search_store`**: Search games on Steam by title query to discover Steam AppIDs.
- **`get_store_details`**: Fetch official store metadata (genres, categories, description, developers, metacritic, release date).
- **`get_app_reviews`**: Fetch Steam player review statistics (positive review percentage, total review count, rating score string like "Overwhelmingly Positive").
- **`get_app_tags`**: Extract community user-defined tags (*Roguelike*, *Deckbuilder*, *Souls-like*, *Co-op*, etc.).
- **Built-in In-Memory Cache**: 1-hour TTL caching layer to protect against rate limits and maximize efficiency.

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Running

```bash
npm start
```

## MCP Configuration

Add the following entry to your MCP configuration file (`mcp_config.json`):

### Option 1: Using NPX (Recommended)

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

### Option 2: Using Local Build

```json
{
  "mcpServers": {
    "steam-storefront": {
      "command": "node",
      "args": ["/path/to/steam-storefront-mcp/dist/index.js"]
    }
  }
}
```

## License

MIT
