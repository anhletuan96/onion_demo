import express, { Request, Response } from "express";
import https from "https";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));
app.use(express.raw({ type: "text/*", limit: "10mb" }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// Interface for request body
interface LsrpcRequest {
    method: "get_message" | "send_message";
    params?: {
        msgId?: string;
        msg?: string;
        conversationId?: string;
        [key: string]: any;
    };
}

const db: { [key: string]: any } = {};

// POST /oxen/custom-endpoint/lsrpc endpoint
app.post(
    "/oxen/custom-endpoint/lsrpc",
    (req: Request<{}, {}, LsrpcRequest>, res: Response) => {
        const body = parseRequestBody(req);
        const { method, params } = body;
        // Validate method
        if (
            !method ||
            (method !== "get_message" && method !== "send_message")
        ) {
            return res.status(400).json({
                error: 'Invalid method. Must be either "get_message" or "send_message"',
            });
        }

        // Handle different methods
        switch (method) {
            case "get_message":
                const msgId = params.msgId;
                let data = db[msgId];
                if (!msgId || !data) {
                    data = {
                        msgId: "12345",
                        content: "Hello, this is a sample message!",
                        timestamp: new Date().toISOString(),
                        sender: "user123",
                        recipient: "user456",
                        encrypted: true,
                    };
                }
                return res.json({
                    success: true,
                    method: "get_message",
                    data,
                });

            case "send_message":
                const msg = {
                    msgId: new Date().getTime().toString(),
                    msg: params.msg,
                    status: "sent",
                    timestamp: new Date().toISOString(),
                    recipient: "user789",
                    deliveryStatus: "pending",
                    encrypted: true,
                    confirmationCode: "ABC123XYZ",
                };
                db[msg.msgId] = msg;
                return res.json({
                    success: true,
                    method: "send_message",
                    data: msg,
                });

            default:
                return res.status(400).json({
                    error: "Unsupported method",
                });
        }
    }
);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start server
const USE_HTTPS = process.env.USE_HTTPS === 'true';

if (USE_HTTPS) {
    // HTTPS Configuration
    const privateKey = fs.readFileSync('key.pem', 'utf8');
    const certificate = fs.readFileSync('cert.pem', 'utf8');
    
    const credentials = {
        key: privateKey,
        cert: certificate
    };
    
    const httpsServer = https.createServer(credentials, app);
    
    httpsServer.listen(PORT, () => {
        console.log(`🔒 HTTPS Server is running on port ${PORT}`);
        console.log(`🏥 Health check: https://localhost:${PORT}/health`);
        console.log(`📡 LSRPC endpoint: https://localhost:${PORT}/oxen/custom-endpoint/lsrpc`);
    });
} else {
    // HTTP Configuration
    app.listen(PORT, () => {
        console.log(`🔓 HTTP Server is running on port ${PORT}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
        console.log(`📡 LSRPC endpoint: http://localhost:${PORT}/oxen/custom-endpoint/lsrpc`);
    });
}

// Helper function to clean corrupted prefixes from onion request body
function cleanCorruptedPrefix(bodyString: string): string {
    // Find the first valid JSON object
    const jsonStart = bodyString.indexOf("{");
    if (jsonStart > 0) {
        const prefix = bodyString.substring(0, jsonStart);
        return bodyString.substring(jsonStart);
    }
    return bodyString;
}

// Helper function to parse binary onion request data
function parseBinaryOnionRequest(body: Buffer): any {
    console.log("🔧 Parsing binary onion request data...");

    try {
        // Try to convert to string and clean prefixes
        const bodyString = body.toString("utf8");

        // Clean corrupted prefixes
        const cleanedBody = cleanCorruptedPrefix(bodyString);

        // Extract JSON objects from cleaned data
        if (cleanedBody.includes("{") && cleanedBody.includes("}")) {
            const jsonObjects: any[] = [];
            let currentPos = 0;

            while (currentPos < cleanedBody.length) {
                const braceStart = cleanedBody.indexOf("{", currentPos);
                if (braceStart === -1) break;

                // Find the matching closing brace
                let braceCount = 0;
                let braceEnd = -1;

                for (let i = braceStart; i < cleanedBody.length; i++) {
                    if (cleanedBody[i] === "{") braceCount++;
                    if (cleanedBody[i] === "}") braceCount--;

                    if (braceCount === 0) {
                        braceEnd = i;
                        break;
                    }
                }

                if (braceEnd !== -1) {
                    const jsonString = cleanedBody.substring(
                        braceStart,
                        braceEnd + 1
                    );

                    try {
                        const parsed = JSON.parse(jsonString);
                        jsonObjects.push(parsed);
                    } catch (error: any) {
                        console.log(
                            "❌ Failed to parse JSON object from binary:",
                            jsonString,
                            "Error:",
                            error.message
                        );
                    }

                    currentPos = braceEnd + 1;
                } else {
                    break;
                }
            }

            // The first object is always the actual request payload
            if (jsonObjects.length > 0) {
                const firstObject = jsonObjects[0];
                console.log("request payload:", firstObject);
                return firstObject;
            }
        }

        // Fallback: try to parse the entire cleaned string as JSON
        try {
            const parsed = JSON.parse(cleanedBody);
            console.log("✅ Successfully parsed cleaned binary data as JSON");
            return parsed;
        } catch (error: any) {
            console.log(
                "❌ Failed to parse cleaned binary data as JSON:",
                error
            );
            return {
                raw_body: cleanedBody,
                original_binary_length: body.length,
                body_type: "binary_cleaned",
                parse_error: error.message,
            };
        }
    } catch (error: any) {
        console.log("❌ Failed to process binary data:", error);
        return {
            body_type: "binary_error",
            error: error.message,
            binary_length: body.length,
        };
    }
}

function parseRequestBody(req: Request): any {
    // If body is already parsed JSON (from regular HTTP requests)
    if (
        req.body &&
        typeof req.body === "object" &&
        !Buffer.isBuffer(req.body)
    ) {
        console.log("✅ Body is already parsed JSON");
        return req.body;
    }

    // 🔧 OPTION 2: Handle binary data properly
    if (req.headers["content-type"] === "application/octet-stream") {
        console.log("🔧 Binary data detected, handling as octet-stream...");
        return parseBinaryOnionRequest(req.body);
    }

    console.log("❌ No body or unrecognized body type");
    return null;
}

export default app;
