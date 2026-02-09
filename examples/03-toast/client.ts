import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withAuthToken } from "../shared/auth-helper.js";

const PORT = process.env.EIDOU_MCP_PORT || "3100";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(baseUrl: URL, client: Client) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 40; attempt++) {
    const transport = new StreamableHTTPClientTransport(baseUrl);
    try {
      await client.connect(transport);
      return transport;
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("Failed to connect to MCP server.");
}

async function main() {
  const client = new Client(
    { name: "eidou-example-03", version: "1.0.0" },
    { capabilities: {} }
  );

  const baseUrl = new URL(`http://127.0.0.1:${PORT}/mcp`);
  const authUrl = withAuthToken(baseUrl);

  // Connect
  const transport = await connectWithRetry(authUrl, client);
  console.log("Connected to Eidou MCP.");

  // Toast 1: Info
  console.log("Sending Toast 1 (Info)...");
  await client.callTool({
    name: "show_toast",
    arguments: {
      message: "System initialize complete.",
      variant: "info",
      title: "Boot Sequence",
      duration_ms: 5000
    }
  });

  await wait(500);

  // Toast 2: Success
  console.log("Sending Toast 2 (Success)...");
  await client.callTool({
    name: "show_toast",
    arguments: {
      message: "Connection established securely.",
      variant: "success",
      title: "Network",
      duration_ms: 5000
    }
  });

  await wait(500);

  // Toast 3: Warning
  console.log("Sending Toast 3 (Warning)...");
  await client.callTool({
    name: "show_toast",
    arguments: {
      message: "High latency detected on node-3.",
      variant: "warning",
      title: "Performance",
      duration_ms: 5000
    }
  });

  await wait(2000);

  // Toast 4: Error
  console.log("Sending Toast 4 (Error)...");
  try {
    await client.callTool({
        name: "show_toast",
        arguments: {
        message: "Critical failure in cooling system.",
        variant: "error",
        title: "Alert",
        duration_ms: 3000
        }
    });
    console.log("Toast 4 sent successfully.");
  } catch (e) {
      console.log("Toast 4 failed (likely pool full):", e);
  }

  console.log("Waiting for toasts to clear...");
  await wait(5000);
  console.log("Done.");

  await transport.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
