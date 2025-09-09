import { randomBytes, createHmac } from "crypto";
import * as nacl from "tweetnacl";

/**
 * WORKING HopEncryption class - AES-GCM implementation
 * Based on successful test with storage server from oxen-client.js
 */
export class HopEncryption {
    private privateKey: Buffer;
    private publicKey: Buffer;
    private isServer: boolean;

    constructor(
        privateKey: Buffer,
        publicKey: Buffer,
        isServer: boolean = false
    ) {
        this.privateKey = privateKey.slice(0, 32);
        this.publicKey = publicKey.slice(0, 32);
        this.isServer = isServer;
    }

    /**
     * WORKING: Derive symmetric key using HMAC-SHA256 with salt "LOKI"
     * This is the exact method that works with storage server
     */
    deriveSymmetricKey(
        seckey: Buffer,
        pubkey: Buffer,
        isForDecryption: boolean = false
    ): Buffer {
        // Compute Curve25519 shared secret
        const sharedSecret = nacl.scalarMult(seckey, pubkey);

        // HMAC-SHA256 with salt "LOKI"
        const salt = Buffer.from("LOKI");
        const hmac = createHmac("sha256", salt);
        hmac.update(sharedSecret);

        return hmac.digest();
    }

    /**
     * WORKING: AES-GCM encryption using WebCrypto API
     * This method successfully works with storage server
     */
    async encryptAESGCM(
        plaintext: Buffer,
        recipientPubKey: Buffer
    ): Promise<Buffer> {
        console.log("🔐 HopEncryption.encrypt AESGCM");
        console.log(
            "  Recipient pubkey:",
            Buffer.from(recipientPubKey).toString("hex")
        );

        // Derive symmetric key
        const key = this.deriveSymmetricKey(this.privateKey, recipientPubKey);
        console.log("  Symmetric key:", Buffer.from(key).toString("hex"));

        // Generate IV (12 bytes for GCM)
        const iv = randomBytes(12);
        console.log("  IV:", Buffer.from(iv).toString("hex"));

        // Use WebCrypto API for AES-GCM
        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            new Uint8Array(key),
            { name: "AES-GCM" },
            false,
            ["encrypt"]
        );

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            cryptoKey,
            new Uint8Array(plaintext)
        );

        // Create result buffer explicitly to avoid type issues
        const ivBuffer = Buffer.from(iv);
        const encryptedBuffer = Buffer.from(encrypted);
        const result = Buffer.concat([ivBuffer, encryptedBuffer]);

        return result;
    }

    /**
     * WORKING: Main encrypt method using AES-GCM
     */
    async encrypt(
        encType: string,
        plaintext: Buffer,
        recipientPubKey: Buffer
    ): Promise<Buffer> {
        if (encType === "aes-gcm" || encType === "gcm") {
            return await this.encryptAESGCM(plaintext, recipientPubKey);
        }
        throw new Error(`Unsupported encryption type: ${encType}`);
    }

    /**
     * AES-GCM decryption (for completeness)
     */
    async decryptAESGCM(
        ciphertext: Buffer,
        senderPubKey: Buffer
    ): Promise<Buffer> {
        console.log("🔓 HopEncryption.decryptAESGCM");

        if (ciphertext.length < 12 + 16) {
            // IV + min tag
            throw new Error("Ciphertext too short for AES-GCM");
        }

        // Extract IV and encrypted data
        const iv = ciphertext.slice(0, 12);
        const encrypted = ciphertext.slice(12);

        // Derive symmetric key
        const key = this.deriveSymmetricKey(
            this.privateKey,
            senderPubKey,
            true
        );

        // Decrypt with WebCrypto
        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            new Uint8Array(key),
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            cryptoKey,
            new Uint8Array(encrypted)
        );

        // Create result buffer explicitly to avoid type issues
        const decryptedBuffer = Buffer.from(decrypted);
        return decryptedBuffer;
    }

    /**
     * Main decrypt method
     */
    async decrypt(
        encType: string,
        ciphertext: Buffer,
        senderPubKey: Buffer
    ): Promise<Buffer> {
        if (encType === "aes-gcm" || encType === "gcm") {
            return await this.decryptAESGCM(ciphertext, senderPubKey);
        } else if (encType === "xchacha20") {
            // Fallback to AES-GCM
            return await this.decryptAESGCM(ciphertext, senderPubKey);
        }
        throw new Error(`Unsupported encryption type: ${encType}`);
    }
}

/**
 * CryptoUtils class from working oxen-client.js
 */
export class CryptoUtils {
    /**
     * Convert hex string to Buffer
     */
    static fromHex(hex: string): Buffer {
        return Buffer.from(hex, "hex");
    }

    /**
     * Convert Buffer to hex string
     */
    static toHex(buffer: Buffer): string {
        return buffer.toString("hex");
    }

    /**
     * Convert Buffer to base64 string
     */
    static toBase64(buffer: Buffer): string {
        return buffer.toString("base64");
    }

    /**
     * Convert base64 string to Buffer
     */
    static fromBase64(base64: string): Buffer {
        return Buffer.from(base64, "base64");
    }

    /**
     * Get current timestamp
     */
    static timestamp(): number {
        return Date.now();
    }
}
