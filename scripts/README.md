# Scripts Usage Guide

This directory contains utility scripts for running the E2EE demo server with onion request capabilities.

## Scripts

### 1. `start-server-ngrok.sh` - Start Server + Ngrok Tunnel

Starts the Express server on port 3001 and creates a public ngrok tunnel.

**Features:**
- ✅ Starts Express TypeScript server
- ✅ Creates ngrok tunnel on port 3001
- ✅ Auto-detects ngrok public URL
- ✅ Tests local endpoint
- ✅ Graceful cleanup on Ctrl+C

**Usage:**
```bash
# Direct execution
./scripts/start-server-ngrok.sh

# Or via npm
npm run start-ngrok
```

**Requirements:**
- ngrok installed and in PATH
- Port 3001 available

**Output Example:**
```
🚀 Starting Express server and ngrok tunnel...
✅ Express server is running on port 3001
✅ Ngrok tunnel is active!
🌐 Public URL: https://abc123.ngrok-free.app
📋 API Endpoint: https://abc123.ngrok-free.app/oxen/custom-endpoint/lsrpc
🏥 Health Check: https://abc123.ngrok-free.app/health
```

### 2. `send-onion-request.sh` - Send Onion Requests

Sends encrypted onion requests through the Oxen service node network.

**Features:**
- ✅ Supports both `get_message` and `send_message` methods
- ✅ Auto-generates parameters: `msgId` for get_message, `msg` for send_message
- ✅ Auto-detects ngrok URLs or uses local server
- ✅ Routes through 3-hop onion circuit
- ✅ Comprehensive error handling
- ✅ Colored output for better readability

**Usage:**
```bash
# Basic usage (defaults to get_message)
./scripts/send-onion-request.sh

# Specify method
./scripts/send-onion-request.sh -m send_message

# Use specific ngrok URL
./scripts/send-onion-request.sh -u https://abc123.ngrok-free.app -m get_message

# Use local server
./scripts/send-onion-request.sh -l -m send_message

# Show help
./scripts/send-onion-request.sh -h
```

**npm Shortcuts:**
```bash
# Send get_message via onion
npm run onion-get

# Send send_message via onion  
npm run onion-send

# General onion request (with options)
npm run send-onion -- -m send_message -u https://your-ngrok-url.app
```

**Options:**
- `-m, --method <method>`: Method to call (`get_message` or `send_message`)
- `-u, --url <ngrok_url>`: Specific ngrok URL to use
- `-l, --local`: Use local server instead of ngrok
- `-h, --help`: Show help message

**Auto-generated Parameters:**
- `get_message`: Includes `msgId` (timestamp-based)
- `send_message`: Includes `msg` (greeting with timestamp)

## Complete Workflow

### 1. Start the server with ngrok tunnel:
```bash
npm run start-ngrok
```

### 2. In another terminal, send onion requests:
```bash
# Test get_message
npm run onion-get

# Test send_message  
npm run onion-send

# Or with custom URL
./scripts/send-onion-request.sh -u https://your-ngrok-url.app -m get_message
```

## Requirements

### For `start-server-ngrok.sh`:
- **ngrok**: Download from https://ngrok.com/download
- **Node.js & npm**: For running the TypeScript server
- **Port 3001**: Must be available

### For `send-onion-request.sh`:
- **All server dependencies**: The script uses the same onion builder
- **Service nodes**: Configured in the script (hardcoded list)
- **Network access**: To reach Oxen service nodes

## Troubleshooting

### Ngrok Issues:
```bash
# Check if ngrok is installed
which ngrok

# Check ngrok status
curl http://localhost:4040/api/tunnels
```

### Server Issues:
```bash
# Check if port 3001 is in use
lsof -i :3001

# Test local server directly
curl http://localhost:3001/health
```

### Onion Request Issues:
- Check network connectivity
- Verify service nodes are accessible
- Review error messages in colored output

## Security Notes

- 🔐 All onion requests are encrypted through 3 service nodes
- 🌐 Ngrok exposes your local server to the internet
- 🧅 Service node public keys are hardcoded for consistency
- 🔑 No persistent key storage (generates ephemeral keys)

## Script Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│   start-server-     │    │   send-onion-       │
│   ngrok.sh          │    │   request.sh        │
├─────────────────────┤    ├─────────────────────┤
│ • Start Express     │    │ • Parse arguments   │
│ • Start ngrok       │    │ • Create temp script│
│ • Monitor processes │    │ • Execute onion req │
│ • Cleanup on exit   │    │ • Handle errors     │
└─────────────────────┘    └─────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────┐
│            Express Server                       │
│        (server.ts / dist/)                     │
├─────────────────────────────────────────────────┤
│ • /oxen/custom-endpoint/lsrpc                  │
│ • /health                                      │
│ • Binary request parsing                       │
│ • JSON response formatting                     │
└─────────────────────────────────────────────────┘
```
