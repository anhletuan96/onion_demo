# E2EE Demo Server

Express TypeScript server with custom LSRPC endpoint.

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

## Start

```bash
npm start
```

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

## Example Usage

```bash
# Get message
curl -X POST http://localhost:3000/oxen/custom-endpoint/lsrpc \
  -H "Content-Type: application/json" \
  -d '{"method": "get_message"}'

# Send message
curl -X POST http://localhost:3000/oxen/custom-endpoint/lsrpc \
  -H "Content-Type: application/json" \
  -d '{"method": "send_message"}'
```
