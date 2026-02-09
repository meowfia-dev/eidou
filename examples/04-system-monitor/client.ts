import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import baseWidget from "./widget.json" with { type: "json" };
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

// State for random walks
let cpu = 45;
let ram = 60;
let disk = 62;

function getNextRandom(current: number, min: number, max: number, step: number = 3) {
  const change = (Math.random() - 0.5) * step * 2;
  let next = current + change;
  if (next < min) next = min;
  if (next > max) next = max;
  return Math.round(next);
}

function updateWidgetTree(node: any, updates: Map<string, any>) {
  if (node.props && node.props.id && updates.has(node.props.id)) {
    Object.assign(node.props, updates.get(node.props.id));
  }
  if (node.children) {
    node.children.forEach((child: any) => updateWidgetTree(child, updates));
  }
}

async function main() {
  const client = new Client(
    { name: "eidou-example-04", version: "1.0.0" },
    { capabilities: {} }
  );

  const baseUrl = new URL(`http://127.0.0.1:${PORT}/mcp`);
  const authUrl = withAuthToken(baseUrl);

  // Connect
  try {
    const transport = await connectWithRetry(authUrl, client);
    console.log("Connected to Eidou MCP.");

    // Set notification handler
    client.setNotificationHandler(
        z.object({ method: z.literal("eidou/user_event"), params: z.any() }),
        async (notification) => {
            // @ts-ignore - params type is known from schema
            const event = notification.params;
            if (event.action === "close" || event.action === "eidou:close") {
                console.log("Widget closed by user. Exiting...");
                await transport.close();
                process.exit(0);
            }
        }
    );

    // Initial Show
    console.log("Showing System Monitor Widget...");
    await client.callTool({
      name: "show_widget",
      arguments: {
        widget_id: "04-system-monitor",
        title: "System Monitor",
        ui: baseWidget
      }
    });

    // Update Loop
    setInterval(async () => {
      // Update values
      cpu = getNextRandom(cpu, 40, 85);
      ram = getNextRandom(ram, 55, 75);
      disk = disk + 0.1; 
      if (disk > 99) disk = 99; // Cap disk

      const now = new Date();
      const timeString = now.toLocaleTimeString("en-US", { hour12: false });

      const updates = new Map<string, any>();
      updates.set("clock-text", { content: timeString });
      updates.set("cpu-progress", { value: cpu, label: `${cpu}%` });
      updates.set("ram-progress", { value: ram, label: `${ram}%` });
      updates.set("disk-progress", { value: Math.round(disk), label: `${Math.round(disk)}%` });

      // Clone and update
      const newWidget = JSON.parse(JSON.stringify(baseWidget));
      updateWidgetTree(newWidget, updates);

      // Push update
      // console.log(`Pushing update: CPU ${cpu}% RAM ${ram}% DISK ${Math.round(disk)}%`);
      try {
        await client.callTool({
          name: "show_widget",
          arguments: {
            widget_id: "04-system-monitor",
            title: "System Monitor",
            ui: newWidget
          }
        });
      } catch (e) {
        console.error("Update failed:", e);
      }
    }, 1000);

  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
