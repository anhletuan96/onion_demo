import {
    OnionBuilder,
    OnionDestination,
    ServiceNode,
} from "./onion/onion-builder";

async function testOnionRequest() {
    try {
        console.log("🧪 Testing Onion Request Sending...\n");

        const onionBuilder = new OnionBuilder(SERVICE_NODES, 3);
        // await onionBuilder.updateServiceNodes(3);
        console.log("📤 Sending onion request...");

        // Test with a custom server destination (not a service node)
        const customServer: OnionDestination = {
            host: "4c98b41e8e1a.ngrok-free.app", // Your public ngrok URL
            port: 443, // HTTPS port
            protocol: "https", // Protocol
            target: "/oxen/custom-endpoint/lsrpc", // Target endpoint
        };

        console.log("🚀 Testing onion request to custom server...");

        try {
            // Create payload object directly
            const payload = {
                method: "get_message",
                params: {
                    msgId: "1757402775049",
                },
                // method: "send_message",
                // params: {
                //     msg: "Hello 112",
                // },
            };
            // 1757402764879
            // 1757402775049

            const result = await onionBuilder.sendOnionRequest(
                payload,
                customServer
            );
            console.log("✅ Onion request successful!");
            console.log("Status:", result.statusCode);
            console.log("Response:", result.body);
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error("❌ Onion request failed:", errorMessage);
        }
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : String(error);
        console.error("❌ Test failed:", errorMessage);
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

// Run the test
testOnionRequest().catch(console.error);
