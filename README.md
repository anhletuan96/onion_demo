# E2EE Demo Server

Express TypeScript server with custom LSRPC endpoint and Onion Request capabilities.

## Quick Start

### 🚀 Start Server + Ngrok Tunnel

```bash
npm run start-ngrok
```

### 🧅 Send Onion Requests

```bash
# Send get_message via onion network
npm run onion-get

# Send send_message via onion network
npm run onion-send
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Scripts

| Script                | Description                          |
| --------------------- | ------------------------------------ |
| `npm run start-ngrok` | Start server and create ngrok tunnel |
| `npm run onion-get`   | Send get_message via onion network   |
| `npm run onion-send`  | Send send_message via onion network  |

See [`scripts/README.md`](scripts/README.md) for detailed documentation.

## API Endpoints

### POST /oxen/custom-endpoint/lsrpc

Request body:

```json
{
    "method": "get_message"
}
```

or

```json
{
    "method": "send_message"
}
```

### GET /health

Health check endpoint.

## Regular HTTP Example Usage

```bash
# Get message
curl -X POST http://localhost:3001/oxen/custom-endpoint/lsrpc \
  -H "Content-Type: application/json" \
  -d '{"method": "get_message"}'

# Send message
curl -X POST http://localhost:3001/oxen/custom-endpoint/lsrpc \
  -H "Content-Type: application/json" \
  -d '{"method": "send_message"}'
```

## Requirements

-   **Node.js** (v16+)
-   **TypeScript** (included in dev dependencies)
-   **ngrok** (for public tunneling) - Download from https://ngrok.com/download
