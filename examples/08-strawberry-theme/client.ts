import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import widget from "./widget.json" with { type: "json" };
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
  throw lastError || new Error("Failed to connect to MCP server.");
}

// Widget B: embedded default theme widget for contrast
const defaultWidget = {
  type: "projection",
  props: {
    title: "Eidou Default",
    size: { width: 320, height: 200 }
  },
  children: [{
    type: "field",
    props: { safeArea: true, contentPadding: "md", align: "center" },
    children: [{
      type: "shard",
      props: { title: "Default Theme", variant: "glass", closable: true },
      children: [{
        type: "col",
        props: { gap: "4", align: "center" },
        children: [
          { type: "icon", props: { name: "terminal", size: 32, color: "primary" } },
          { type: "text", props: { content: "Standard Eidou Theme", variant: "h3" } },
          { type: "text", props: { content: "Compare with Strawberry!", variant: "body", color: "muted" } }
        ]
      }]
    }]
  }]
};

async function main() {
  const client = new Client(
    { name: "eidou-example-08", version: "1.0.0" },
    { capabilities: {} }
  );

  const baseUrl = new URL(`http://127.0.0.1:${PORT}/mcp`);
  const authUrl = withAuthToken(baseUrl);
  let transport: StreamableHTTPClientTransport | null = null;
  let cloneCount = 0;

  // Event handler
  const UserEventSchema = z.object({
    method: z.literal("eidou/user_event"),
    params: z.any(),
  });

  client.setNotificationHandler(UserEventSchema, async (notification) => {
    const { action } = notification.params;

    if (action === "close" || action === "close_self") {
      console.log("Close requested. Shutting down...");
      shutdown();
    } else if (action === "spawn_clone") {
      cloneCount++;
      const cloneId = `08-strawberry-clone-${cloneCount}`;
      console.log(`Spawning clone: ${cloneId}`);
      
      // Spawn another strawberry widget
      const cloneWidget = JSON.parse(JSON.stringify(widget));
      cloneWidget.props.title = `Strawberry Clone #${cloneCount}`;
      
      try {
        await client.callTool({
          name: "show_widget",
          arguments: { widget_id: cloneId, title: cloneWidget.props.title, ui: cloneWidget }
        });
        console.log(`Clone ${cloneId} spawned!`);
      } catch (e) {
        console.error("Failed to spawn clone:", e);
      }
    }
  });

  const shutdown = async () => {
    // Clean up widgets
    try { await client.callTool({ name: "close_widget", arguments: { widget_id: "08-strawberry" } }); } catch (e) {}
    try { await client.callTool({ name: "close_widget", arguments: { widget_id: "08-default" } }); } catch (e) {}
    for (let i = 1; i <= cloneCount; i++) {
      try { await client.callTool({ name: "close_widget", arguments: { widget_id: `08-strawberry-clone-${i}` } }); } catch (e) {}
    }
    if (transport) await transport.close().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    console.log(`Connecting to ${authUrl}...`);
    transport = await connectWithRetry(authUrl, client);
    console.log("Connected!");

    // Spawn Widget A: Strawberry Theme
    console.log("Spawning Strawberry Theme widget...");
    await client.callTool({
      name: "show_widget",
      arguments: { widget_id: "08-strawberry", title: "Strawberry OS", ui: widget }
    });

    await wait(500);

    // Spawn Widget B: Default Theme (for contrast)
    console.log("Spawning Default Theme widget...");
    await client.callTool({
      name: "show_widget",
      arguments: { widget_id: "08-default", title: "Eidou Default", ui: defaultWidget }
    });

    console.log("Both widgets active. Click 'Spawn Clone' to create more!");
    console.log("Press Ctrl+C to close all.");

    // Keep alive
    await new Promise(() => {});
  } catch (e) {
    console.error(e);
    shutdown();
  }
}

main();
