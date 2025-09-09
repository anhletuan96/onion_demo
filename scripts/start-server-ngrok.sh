#!/bin/bash

# Script to start the Express server and run ngrok on port 3001

echo "🚀 Starting Express server and ngrok tunnel..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup processes on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    
    # Kill the server process
    if [ ! -z "$SERVER_PID" ]; then
        echo -e "${YELLOW}🔪 Stopping Express server (PID: $SERVER_PID)${NC}"
        kill $SERVER_PID 2>/dev/null
    fi
    
    # Kill ngrok process
    if [ ! -z "$NGROK_PID" ]; then
        echo -e "${YELLOW}🔪 Stopping ngrok (PID: $NGROK_PID)${NC}"
        kill $NGROK_PID 2>/dev/null
    fi
    
    # Also kill any remaining ngrok processes
    pkill -f "ngrok http" 2>/dev/null
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok is not installed or not in PATH${NC}"
    echo -e "${YELLOW}💡 Please install ngrok from https://ngrok.com/download${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Please run this script from the project root directory${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing npm dependencies...${NC}"
    npm install
fi

# Build the project if needed
if [ ! -d "dist" ]; then
    echo -e "${BLUE}🔨 Building TypeScript project...${NC}"
    npm run build
fi

# Start the Express server in background
echo -e "${BLUE}🖥️  Starting Express server on port 3001...${NC}"
npm run dev &
SERVER_PID=$!

# Wait a bit for server to start
echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
sleep 3

# Check if server is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${RED}❌ Server failed to start on port 3001${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Express server is running on port 3001${NC}"

# Start ngrok tunnel
echo -e "${BLUE}🌐 Starting ngrok tunnel for port 3001...${NC}"
ngrok http 3001 --log=stdout &
NGROK_PID=$!

# Wait a bit for ngrok to start
sleep 3

# Try to get the ngrok URL
echo -e "${YELLOW}⏳ Retrieving ngrok public URL...${NC}"
NGROK_URL=""
for i in {1..10}; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4 | head -1)
    if [ ! -z "$NGROK_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$NGROK_URL" ]; then
    echo -e "${RED}❌ Failed to get ngrok public URL${NC}"
    echo -e "${YELLOW}💡 You can check manually at http://localhost:4040${NC}"
else
    echo -e "${GREEN}✅ Ngrok tunnel is active!${NC}"
    echo -e "${GREEN}🌐 Public URL: ${NGROK_URL}${NC}"
    echo -e "${BLUE}📋 API Endpoint: ${NGROK_URL}/oxen/custom-endpoint/lsrpc${NC}"
    echo -e "${BLUE}🏥 Health Check: ${NGROK_URL}/health${NC}"
fi

echo -e "\n${GREEN}🎉 Services are running!${NC}"
echo -e "${YELLOW}📊 Monitor ngrok at: http://localhost:4040${NC}"
echo -e "${YELLOW}🔄 Press Ctrl+C to stop all services${NC}\n"

# Test the local endpoint
echo -e "${BLUE}🧪 Testing local endpoint with parameters...${NC}"
echo -e "${YELLOW}Testing get_message with msgId:${NC}"
curl -X POST http://localhost:3001/oxen/custom-endpoint/lsrpc \
     -H "Content-Type: application/json" \
     -d '{"method": "get_message", "params": {"msgId": "test123"}}' | jq '.' 2>/dev/null || echo "Response received (install jq for formatted JSON)"

echo -e "\n${YELLOW}Testing send_message with msg:${NC}"
curl -X POST http://localhost:3001/oxen/custom-endpoint/lsrpc \
     -H "Content-Type: application/json" \
     -d '{"method": "send_message", "params": {"msg": "Hello from test!"}}' | jq '.' 2>/dev/null || echo "Response received (install jq for formatted JSON)"

echo -e "\n${YELLOW}🔄 Services are running. Press Ctrl+C to stop...${NC}"

# Keep the script running
wait
