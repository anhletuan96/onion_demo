#!/bin/bash

# Script to send onion requests for get_message/send_message

echo "🧅 Onion Request Sender Script"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
METHOD="get_message"
NGROK_URL=""
USE_LOCAL=false
MSG_ID=""
MESSAGE_TEXT=""

# Function to show usage
show_usage() {
    echo -e "${BLUE}Usage: $0 [OPTIONS]${NC}"
    echo -e "${YELLOW}Options:${NC}"
    echo -e "  -m, --method <method>    Method to call: 'get_message' or 'send_message' (default: get_message)"
    echo -e "  -i, --msgid <msgId>      Message ID for get_message (default: auto-generated)"
    echo -e "  -t, --message <text>     Message text for send_message (default: auto-generated)"
    echo -e "  -u, --url <ngrok_url>    Ngrok URL to use (e.g., https://abc123.ngrok-free.app)"
    echo -e "  -l, --local              Use local server (http://localhost:3001) instead of ngrok"
    echo -e "  -h, --help               Show this help message"
    echo -e "\n${YELLOW}Examples:${NC}"
    echo -e "  $0 -m get_message -i 12345 -u https://abc123.ngrok-free.app"
    echo -e "  $0 -m send_message -t 'Hello World' -l"
    echo -e "  $0 --method send_message --url https://abc123.ngrok-free.app"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--method)
            METHOD="$2"
            shift 2
            ;;
        -i|--msgid)
            MSG_ID="$2"
            shift 2
            ;;
        -t|--message)
            MESSAGE_TEXT="$2"
            shift 2
            ;;
        -u|--url)
            NGROK_URL="$2"
            shift 2
            ;;
        -l|--local)
            USE_LOCAL=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Validate method
if [[ "$METHOD" != "get_message" && "$METHOD" != "send_message" ]]; then
    echo -e "${RED}❌ Invalid method: $METHOD${NC}"
    echo -e "${YELLOW}💡 Method must be either 'get_message' or 'send_message'${NC}"
    exit 1
fi

# Determine the target URL
if [ "$USE_LOCAL" = true ]; then
    TARGET_URL="http://localhost:3001"
    echo -e "${BLUE}🏠 Using local server: $TARGET_URL${NC}"
else
    if [ -z "$NGROK_URL" ]; then
        # Try to auto-detect ngrok URL
        echo -e "${YELLOW}⏳ Auto-detecting ngrok URL...${NC}"
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4 | head -1)
        
        if [ -z "$NGROK_URL" ]; then
            echo -e "${RED}❌ Could not auto-detect ngrok URL${NC}"
            echo -e "${YELLOW}💡 Please provide ngrok URL with -u option or use -l for local server${NC}"
            show_usage
            exit 1
        fi
    fi
    
    TARGET_URL="$NGROK_URL"
    echo -e "${BLUE}🌐 Using ngrok URL: $TARGET_URL${NC}"
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if onion builder exists
if [ ! -f "test.ts" ]; then
    echo -e "${RED}❌ test.ts not found. Onion functionality may not be available${NC}"
    exit 1
fi

echo -e "${PURPLE}🧅 Preparing onion request...${NC}"
echo -e "${YELLOW}📋 Method: $METHOD${NC}"
echo -e "${YELLOW}📋 Target: $TARGET_URL/oxen/custom-endpoint/lsrpc${NC}"

# Create a temporary TypeScript file for the onion request
TEMP_SCRIPT="temp_onion_request_$$_$(date +%s).ts"

cat > "$TEMP_SCRIPT" << EOF
import {
    OnionBuilder,
    OnionDestination,
    ServiceNode,
} from "./onion/onion-builder";

async function sendOnionRequest() {
    try {
        console.log("🧅 Initializing Onion Request...\n");

        const onionBuilder = new OnionBuilder(SERVICE_NODES, 3);
        console.log("📤 Sending onion request...");

        // Parse the target URL
        const url = new URL("$TARGET_URL");
        const destination: OnionDestination = {
            host: url.hostname,
            port: url.protocol === "https:" ? 443 : (url.port ? parseInt(url.port) : 80),
            protocol: url.protocol.slice(0, -1), // Remove trailing ':'
            target: "/oxen/custom-endpoint/lsrpc",
        };

        console.log("🎯 Target destination:", destination);
        console.log("📝 Method: $METHOD");

        try {
            let payload;
            if ("$METHOD" === "get_message") {
                const msgId = "$MSG_ID" || "$(date +%s)001";
                payload = {
                    method: "$METHOD",
                    params: {
                        msgId: msgId,
                    },
                };
            } else if ("$METHOD" === "send_message") {
                const msg = "$MESSAGE_TEXT" || "Hello from onion request - $(date '+%Y-%m-%d %H:%M:%S')";
                payload = {
                    method: "$METHOD",
                    params: {
                        msg: msg,
                    },
                };
            } else {
                payload = {
                    method: "$METHOD",
                    params: {},
                };
            }

            console.log("📦 Payload:", JSON.stringify(payload, null, 2));
            console.log("🚀 Sending request through onion network...");

            const result = await onionBuilder.sendOnionRequest(
                payload,
                destination
            );

            console.log("✅ Onion request successful!");
            console.log("📊 Status:", result.statusCode);
            console.log("📄 Response:");
            console.log(JSON.stringify(result.body, null, 2));

            if (result.statusCode === 200) {
                console.log("🎉 Request completed successfully!");
            } else {
                console.log("⚠️ Request completed with non-200 status");
            }

        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error("❌ Onion request failed:", errorMessage);
            console.error("🔍 Error details:", error);
            process.exit(1);
        }
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        console.error("❌ Initialization failed:", errorMessage);
        process.exit(1);
    }
}

const SERVICE_NODES: ServiceNode[] = [
    {
        pubkey_ed25519:
            "d458bccd428b87db4da22a20b41da2a5672d6d0e3976a24e9f3e594ac593abfd",
        pubkey_x25519:
            "5c27d9a28c3fe2c4ccc58359c661f34dcbbbfc96faa31d5e0de8450f054c8061",
        public_ip: "185.219.84.241",
        storage_lmq_port: 22020,
        storage_port: 22021,
        swarm_id: 17942340915444056063,
    },
    {
        pubkey_ed25519:
            "772b436c009f56c3cb27b78541d27ba41d3c3ac839784dad2d0295689083a027",
        pubkey_x25519:
            "dd3649b11681729d3607239d68c0181c046dcba3e4357fe968a3b0b5247cac27",
        public_ip: "102.219.85.100",
        storage_lmq_port: 20200,
        storage_port: 22100,
        swarm_id: 13402712491054596095,
    },
    {
        pubkey_ed25519:
            "ff7a9782e66b20bc29ee97c6c7591da1a72333df6e3e76ee85b4708cc6788c0b",
        pubkey_x25519:
            "3d723113a98838d576438176230613ea1dd478cfcb890383ba09272796813431",
        public_ip: "154.12.246.164",
        storage_lmq_port: 22020,
        storage_port: 22021,
        swarm_id: 18302628885633695743,
    },
];

// Run the request
sendOnionRequest().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
});
EOF

echo -e "${BLUE}🔄 Executing onion request...${NC}"

# Run the temporary TypeScript file
npx ts-node-dev --transpile-only --no-deps "$TEMP_SCRIPT"
EXIT_CODE=$?

# Clean up temporary file
rm -f "$TEMP_SCRIPT"

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}🎉 Onion request completed successfully!${NC}"
else
    echo -e "\n${RED}❌ Onion request failed with exit code $EXIT_CODE${NC}"
fi

exit $EXIT_CODE
