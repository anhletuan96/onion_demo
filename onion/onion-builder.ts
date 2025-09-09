import axios from "axios";
import * as nacl from "tweetnacl";
import * as https from "https";
import { HopEncryption, CryptoUtils } from "../onion/crypto-util";

export class OnionBuilder {
    private serviceNodes: ServiceNode[];
    private timeout: number; // 10 second timeout
    private onionPathLength: number;
    private logger: ConsoleLogger;

    // Configure axios to handle self-signed certificates for local development
    private httpsAgent: https.Agent;

    // Create axios instance with SSL configuration
    private axiosInstance: any;

    constructor(
        serviceNodes: ServiceNode[],
        onionPathLength: number = 3,
        logLevel: LogLevel = LogLevel.DEV
    ) {
        this.serviceNodes = serviceNodes;
        this.timeout = 10000; // 10 second timeout
        this.onionPathLength = onionPathLength;
        this.logger = new ConsoleLogger(logLevel);

        // Configure axios to handle self-signed certificates for local development
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false, // Allow self-signed certificates
        });

        // Create axios instance with SSL configuration
        this.axiosInstance = axios.create({
            httpsAgent: this.httpsAgent,
            timeout: this.timeout,
        });
    }

    public setOnionPathLength(length: number) {
        this.onionPathLength = length;
    }

    public getServiceNodes() {
        return this.serviceNodes;
    }

    /**
     * Fetch real service nodes from Oxen network
     * Uses multiple seed nodes with retry logic
     */
    public async fetchServiceNodes(limit: number): Promise<ServiceNode[]> {
        this.logger.log(
            `Fetching ${limit} real service nodes from Oxen network...`
        );

        const request = {
            jsonrpc: "2.0",
            id: 0,
            method: "get_n_service_nodes",
            params: {
                limit,
                fields: SERVICE_NODE_FIELDS,
            },
        };

        // Try each seed node until one succeeds
        for (let attempt = 0; attempt < 5; attempt++) {
            for (const seedNodeUrl of OXEN_SEED_NODES) {
                try {
                    this.logger.debug(
                        `Trying seed node: ${seedNodeUrl} (attempt ${
                            attempt + 1
                        })`
                    );

                    const response = (await this.axiosInstance.post(
                        seedNodeUrl,
                        request,
                        {
                            timeout: 10000,
                            headers: { "Content-Type": "application/json" },
                        }
                    )) as { data: GetServiceNodesResponse };

                    if (
                        response.data &&
                        response.data.result &&
                        response.data.result.service_node_states
                    ) {
                        const serviceNodes =
                            response.data.result.service_node_states.map(
                                (node: any) => ({
                                    pubkey_ed25519: node.pubkey_ed25519,
                                    pubkey_x25519: node.pubkey_x25519,
                                    public_ip: node.public_ip,
                                    storage_port: node.storage_port,
                                    storage_lmq_port: node.storage_lmq_port,
                                    swarm_id: node.swarm_id,
                                })
                            );

                        this.logger.log(
                            `Successfully fetched ${serviceNodes.length} service nodes from ${seedNodeUrl}`
                        );
                        return serviceNodes;
                    }
                } catch (error: unknown) {
                    const axiosError = error as any;
                    this.logger.warn(
                        `Failed to fetch from ${seedNodeUrl}:`,
                        axiosError.response?.data?.error?.message ||
                            axiosError.message
                    );
                    continue; // Try next seed node
                }
            }

            // If all seed nodes failed, wait before retry
            if (attempt < 4) {
                this.logger.log(
                    `All seed nodes failed, retrying in 10000ms...`
                );
                await new Promise((resolve) => setTimeout(resolve, 10000));
            }
        }

        throw new Error(
            `Failed to fetch service nodes from all seed nodes after attempts`
        );
    }

    /**
     * Update service nodes with real data from Oxen network
     */
    public async updateServiceNodes(limit: number): Promise<void> {
        try {
            const realServiceNodes = await this.fetchServiceNodes(limit);
            this.serviceNodes = realServiceNodes;
            this.logger.log(
                `Updated service nodes: ${realServiceNodes.length} nodes loaded`
            );
        } catch (error: unknown) {
            this.logger.error("Failed to update service nodes:", error);
            throw error;
        }
    }

    /**
     * Build onion path for routing requests
     * Based on working implementation from oxen-client.js
     */
    public async buildOnionPath(
        pathLength: number = 3
    ): Promise<OnionPathNode[]> {
        try {
            // Use our mock service nodes (which are real Oxen storage servers)
            const serviceNodes = this.serviceNodes;

            // Filter active nodes with required keys
            const activeNodes = serviceNodes.filter(
                (node: ServiceNode) =>
                    node.pubkey_ed25519 &&
                    node.pubkey_x25519 &&
                    node.public_ip &&
                    node.storage_port
            );

            this.logger.debug(`Filtered to ${activeNodes.length} active nodes`);

            if (activeNodes.length < pathLength) {
                throw new Error(
                    `Not enough active service nodes. Need ${pathLength}, got ${activeNodes.length}`
                );
            }

            // Randomly select nodes for the path
            const selectedNodes: any = [];
            const usedIndices = new Set();

            while (selectedNodes.length < pathLength) {
                const randomIndex = Math.floor(
                    Math.random() * activeNodes.length
                );
                if (!usedIndices.has(randomIndex)) {
                    usedIndices.add(randomIndex);
                    selectedNodes.push(activeNodes[randomIndex]);
                }
            }

            const path = selectedNodes.map((node: ServiceNode) => ({
                ed25519_pubkey: node.pubkey_ed25519,
                x25519_pubkey: node.pubkey_x25519,
                ip: node.public_ip,
                port: node.storage_port,
            }));

            return path;
        } catch (error: any) {
            this.logger.error("Failed to build onion path:", error.message);
            throw new Error("Unable to build onion path");
        }
    }

    public async encryptForHop(
        data: Buffer,
        senderSecretKey: Buffer,
        recipientPublicKey: Buffer
    ) {
        const ephemeralKeyPair = nacl.box.keyPair();
        const hopEncryption = new HopEncryption(
            Buffer.from(ephemeralKeyPair.secretKey),
            Buffer.from(ephemeralKeyPair.publicKey),
            false
        );
        const encrypted = await hopEncryption.encrypt(
            "aes-gcm",
            data,
            recipientPublicKey
        );
        const result = Buffer.concat([
            Buffer.from(ephemeralKeyPair.publicKey),
            encrypted,
        ]);
        return result;
    }

    /**
     * WORKING: Build onion request using AES-GCM encryption
     * Based on working implementation from oxen-client.js
     * Now supports custom server destinations only
     */
    public async buildOnionRequest(
        finalPayload: OnionPayload,
        onionPath: OnionPathNode[],
        destination: OnionDestination
    ): Promise<OnionRequestResult> {
        this.logger.log(
            "Building onion request for destination (WORKING AES-GCM):",
            destination.host
        );
        this.logger.debug("Final payload:", JSON.stringify(finalPayload));

        // Generate ephemeral keypair for final destination
        const finalEphemeralKeyPair = nacl.box.keyPair();

        // Step 1: Prepare final payload with exact format
        // Format request.body: P>{${payloadJson}}{"headers":{}}{"host":"...","port":...,"protocol":"...","target":"..."}
        const finalRoute = {
            headers: {}, // Empty object, not empty string
            // json: false,
            // base64: true
        };

        // Encode payload according to format: [size][payload][routing_json]
        const payloadJson = JSON.stringify(finalPayload);
        const routingJson = JSON.stringify(finalRoute);

        const payloadBuffer = Buffer.from(payloadJson);
        const routingBuffer = Buffer.from(routingJson);

        // Size buffer (4 bytes little endian)
        function encodeSize(size: number) {
            const buf = Buffer.allocUnsafe(4);
            buf.writeUInt32LE(size, 0);
            return buf;
        }

        const sizeBuffer = encodeSize(payloadBuffer.length);

        // Combine: [size][payload][routing]
        const finalData = Buffer.concat([
            sizeBuffer,
            payloadBuffer,
            routingBuffer,
        ]);

        let blob: any = finalData;

        this.logger.debug("Final data/blob size:", blob.length);

        // Step 3: Work backwards through onion path
        let ephemeralKeyForNextHop = Buffer.from(
            finalEphemeralKeyPair.publicKey
        );

        for (let i = onionPath.length - 1; i >= 0; i--) {
            const node = onionPath[i];
            const ephemeralKeyPair = nacl.box.keyPair();
            this.logger.debug("===============================");
            this.logger.debug(`Processing hop ${i}, node:`, node.ip);

            // Routing info for this hop
            let routingInfo;
            if (i === onionPath.length - 1) {
                // Final hop - route to custom server destination
                routingInfo = {
                    host: destination.host,
                    port: destination.port,
                    protocol: destination.protocol,
                    target: destination.target,
                };
            } else {
                // Intermediate hop - route to next node in path
                routingInfo = {
                    destination: onionPath[i + 1].ed25519_pubkey,
                    ephemeral_key: CryptoUtils.toHex(ephemeralKeyForNextHop),
                    enc_type: "aes-gcm",
                };
            }

            // Encode this layer: [blob_size][blob][routing_json]
            const routingJson = JSON.stringify(routingInfo);
            const routingBuffer = new TextEncoder().encode(routingJson);

            const blobSizeBuffer = new Uint8Array(4);
            const blobSizeView = new DataView(blobSizeBuffer.buffer);
            blobSizeView.setUint32(0, blob.length, true); // little endian

            const layerData = new Uint8Array(
                blobSizeBuffer.length + blob.length + routingBuffer.length
            );
            layerData.set(blobSizeBuffer, 0);
            layerData.set(blob, blobSizeBuffer.length);
            layerData.set(routingBuffer, blobSizeBuffer.length + blob.length);

            // Encrypt for this hop (AES-GCM)
            const nodeX25519PubKey = CryptoUtils.fromHex(node.x25519_pubkey);
            const nodeHopEncryption = new HopEncryption(
                Buffer.from(ephemeralKeyPair.secretKey),
                Buffer.from(ephemeralKeyPair.publicKey),
                false
            );

            // Convert Uint8Array to Buffer for encryption - use explicit Buffer creation
            const layerDataBuffer = Buffer.alloc(layerData.length);
            layerDataBuffer.set(layerData);
            blob = await nodeHopEncryption.encrypt(
                "aes-gcm",
                layerDataBuffer,
                nodeX25519PubKey
            );
            this.logger.debug(
                `Encrypted for hop ${i}, new blob size:`,
                blob.length
            );

            // Update ephemeral key for the next iteration (previous hop)
            ephemeralKeyForNextHop = Buffer.from(ephemeralKeyPair.publicKey);
        }

        // Step 4: Final wrapper for first hop - following libsession-util format
        const wrapperMeta = {
            ephemeral_key: CryptoUtils.toHex(ephemeralKeyForNextHop),
            enc_type: "aes-gcm",
        };

        const wrapperMetaJson = JSON.stringify(wrapperMeta);
        const wrapperMetaBuffer = new TextEncoder().encode(wrapperMetaJson);

        const wrapperSizeBuffer = new Uint8Array(4);
        const wrapperSizeView = new DataView(wrapperSizeBuffer.buffer);
        wrapperSizeView.setUint32(0, blob.length, true); // little endian

        const finalWrapper = new Uint8Array(
            wrapperSizeBuffer.length + blob.length + wrapperMetaBuffer.length
        );
        finalWrapper.set(wrapperSizeBuffer, 0);
        finalWrapper.set(blob, wrapperSizeBuffer.length);
        finalWrapper.set(
            wrapperMetaBuffer,
            wrapperSizeBuffer.length + blob.length
        );

        this.logger.debug("Final wrapper size:", finalWrapper.length);

        return {
            encryptedPayload: finalWrapper,
            entryNode: onionPath[0],
            ephemeralKey: ephemeralKeyForNextHop,
            finalEphemeralKeyPair: finalEphemeralKeyPair,
        };
    }

    /**
     * WORKING: Send onion request through the network using AES-GCM
     * Based on working implementation from oxen-client.js
     * Now supports custom server destinations only
     */
    public async sendOnionRequest(
        payload: OnionPayload,
        customDestination: OnionDestination
    ): Promise<OnionResponse> {
        if (!customDestination) {
            throw new Error("Custom destination is required");
        }

        // Validate destination structure
        if (
            !customDestination.host ||
            !customDestination.port ||
            !customDestination.protocol ||
            !customDestination.target
        ) {
            throw new Error(
                "Custom destination must have host, port, protocol, and target properties"
            );
        }

        this.logger.log(
            "Using custom server destination:",
            customDestination.host + ":" + customDestination.port
        );

        // Build onion path
        const onionPath = await this.buildOnionPath(this.onionPathLength);
        this.logger.debug("Onion path:", onionPath);

        // Build the onion request with the payload directly
        const onionRequest = await this.buildOnionRequest(
            payload,
            onionPath,
            customDestination
        );

        // Send the raw onion request
        return this.sendRawOnionRequest(onionRequest);
    }

    /**
     * Send raw onion request to the entry node
     * Separates the onion building logic from the network sending logic
     */
    public async sendRawOnionRequest(
        onionRequest: OnionRequestResult
    ): Promise<OnionResponse> {
        // Send to entry node using the correct endpoint format
        const entryNodeUrl = `https://${onionRequest.entryNode.ip}:${onionRequest.entryNode.port}`;

        try {
            const response = await this.axiosInstance.post(
                `${entryNodeUrl}/onion_req/v2`,
                onionRequest.encryptedPayload,
                {
                    headers: { "Content-Type": "application/octet-stream" },
                    responseType: "arraybuffer",
                }
            );

            // Return raw response for custom server
            const responseBuffer = Buffer.from(response.data);
            return {
                statusCode: response.status,
                headers: response.headers,
                body: responseBuffer.toString(),
            };
        } catch (error: unknown) {
            const onionError = error as OnionError;
            this.logger.error(
                "Onion request failed:",
                onionError.response?.data?.toString() || onionError.message
            );
            throw new Error(
                `Failed to send onion request: ${onionError.message}`
            );
        }
    }
}

/**
 * Represents a service node in the Oxen network
 */
export interface ServiceNode {
    /** Ed25519 public key for identity verification */
    pubkey_ed25519: string;
    /** X25519 public key for encryption key exchange */
    pubkey_x25519: string;
    /** Public IP address of the node */
    public_ip: string;
    /** LMQ communication port */
    storage_lmq_port: number;
    /** HTTP storage port */
    storage_port: number;
    /** Network grouping identifier */
    swarm_id: number;
}

/**
 * Type definitions for onion request
 */
interface OnionPayload<T = Record<string, unknown>> {
    /** The method/endpoint to call on the destination server */
    method: string;
    /** Parameters to pass to the method */
    params: T;
}

export interface OnionDestination {
    /** Hostname or IP address of the destination server */
    host: string;
    /** Port number of the destination server */
    port: number;
    /** Protocol to use (http or https) */
    protocol: "http" | "https";
    /** Target endpoint path on the destination server */
    target: string;
}

interface OnionPathNode {
    /** Ed25519 public key for identity verification */
    ed25519_pubkey: string;
    /** X25519 public key for encryption key exchange */
    x25519_pubkey: string;
    /** IP address of the service node */
    ip: string;
    /** Port number of the service node */
    port: number;
}

interface OnionResponse {
    /** HTTP status code of the response */
    statusCode: number;
    /** Response headers */
    headers: Record<string, string>;
    /** Response body as string */
    body: string;
}

interface OnionError {
    /** Error message */
    message: string;
    /** Optional response data from axios */
    response?: {
        data?: unknown;
    };
}

interface OnionRequestResult {
    /** Encrypted payload for onion routing */
    encryptedPayload: Uint8Array;
    /** Entry node information */
    entryNode: OnionPathNode;
    /** Ephemeral key for the first hop */
    ephemeralKey: Buffer;
    /** Final ephemeral key pair for destination */
    finalEphemeralKeyPair: {
        publicKey: Uint8Array;
        secretKey: Uint8Array;
    };
}

class ConsoleLogger {
    private logLevel: LogLevel;
    private prefix: string;

    constructor(logLevel: LogLevel = LogLevel.DEV, prefix: string = "🧅") {
        this.logLevel = logLevel;
        this.prefix = prefix;
    }

    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    public getLogLevel(): LogLevel {
        return this.logLevel;
    }

    public setPrefix(prefix: string): void {
        this.prefix = prefix;
    }

    public isProduction(): boolean {
        return this.logLevel === LogLevel.PROD;
    }

    public isDevelopment(): boolean {
        return this.logLevel === LogLevel.DEV;
    }

    public error(message: string, ...args: any[]): void {
        if (this.logLevel === LogLevel.DEV) {
            console.error(`${this.prefix} ❌ ${message}`, ...args);
        }
    }

    public warn(message: string, ...args: any[]): void {
        if (this.logLevel === LogLevel.DEV) {
            console.warn(`${this.prefix} ⚠️ ${message}`, ...args);
        }
    }

    public log(message: string, ...args: any[]): void {
        if (this.logLevel === LogLevel.DEV) {
            console.log(`${this.prefix} ℹ️ ${message}`, ...args);
        }
    }

    public debug(message: string, ...args: any[]): void {
        if (this.logLevel === LogLevel.DEV) {
            console.log(`${this.prefix} 🔍 ${message}`, ...args);
        }
    }
}

enum LogLevel {
    DEV = "dev",
    PROD = "prod",
}

const SERVICE_NODE_FIELDS = {
    public_ip: true,
    storage_port: true,
    pubkey_x25519: true,
    pubkey_ed25519: true,
    storage_lmq_port: true,
    swarm_id: true,
} as const;

const OXEN_SEED_NODES = [
    "http://seed1.getsession.org/json_rpc",
    "http://seed2.getsession.org/json_rpc",
    "http://seed3.getsession.org/json_rpc",
] as const;

interface GetServiceNodesResponse {
    jsonrpc: "2.0";
    id: number;
    result: {
        service_node_states: Array<{
            service_node_pubkey: string;
            public_ip: string;
            storage_port: number;
            pubkey_x25519: string;
            pubkey_ed25519: string;
            storage_lmq_port: number;
            swarm_id: number;
        }>;
    };
}
