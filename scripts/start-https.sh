#!/bin/bash

# Script to generate SSL certificates and start HTTPS server

echo "🔒 SSL Certificate Setup"
echo "======================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if certificates already exist
if [ ! -f "cert.pem" ] || [ ! -f "key.pem" ]; then
    echo -e "${BLUE}📜 Generating SSL certificates...${NC}"
    
    # Generate self-signed certificate
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
        -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Dev/OU=IT/CN=localhost" \
        2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SSL certificates generated successfully${NC}"
        echo -e "${YELLOW}📋 Certificate: cert.pem${NC}"
        echo -e "${YELLOW}📋 Private Key: key.pem${NC}"
    else
        echo -e "${RED}❌ Failed to generate SSL certificates${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ SSL certificates already exist${NC}"
fi

# Set proper permissions for private key
chmod 600 key.pem
chmod 644 cert.pem

echo -e "\n${BLUE}🚀 Starting HTTPS server...${NC}"
echo -e "${YELLOW}💡 Server will run on https://localhost:3001${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop${NC}\n"

# Start HTTPS server
USE_HTTPS=true npm run dev
