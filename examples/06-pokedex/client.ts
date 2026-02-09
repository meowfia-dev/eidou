import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { z } from "zod";
import widget from "./widget.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Locate Eidou Binary
const BIN_PATHS = [
  process.env.EIDOU_BIN,
  resolve(__dirname, "../../src-tauri/target/release/eidou"),
  resolve(__dirname, "../../src-tauri/target/debug/eidou"),
  resolve(__dirname, "../../src-tauri/target/release/eidou.exe"), // Windows
  resolve(__dirname, "../../src-tauri/target/debug/eidou.exe"),   // Windows
];

const eidouBin = BIN_PATHS.find(p => p && existsSync(p));

if (!eidouBin) {
  console.error("Could not find 'eidou' binary.");
  console.error("Please run `cargo build --release` in src-tauri/ or set EIDOU_BIN.");
  process.exit(1);
}

console.log(`Spawning Eidou: ${eidouBin}`);

async function main() {
  // 2. Configure Transport
  // Filter env to prevent release binary from seeing dev vars
  const env = { ...process.env };
  delete env.TAURI_DEV_SERVER_URL;
  delete env.TAURI_ENV_DEBUG;
  delete env.TAURI_DEBUG;
  delete env.TAURI_DEV;

  const transport = new StdioClientTransport({
    command: eidouBin!,
    args: [],
    env: { ...env, EIDOU_POOL_SIZE: "1" }
  });

  // 3. Initialize Client
  const client = new Client(
    {
      name: "eidou-example-06-pokedex",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  const shouldExit = process.argv.includes("--exit");
  const holdMsFlagIndex = process.argv.findIndex((a) => a === "--hold-ms");
  const holdMs =
    holdMsFlagIndex >= 0
      ? Number(process.argv[holdMsFlagIndex + 1] || "")
      : Number.NaN;
  let exitCode = 0;

  try {
    // 4. Connect
    console.log("Connecting to Eidou...");
    await client.connect(transport);
    console.log("Connected!");

    // Notification Handler
    client.setNotificationHandler(
      z.object({ method: z.literal("eidou/user_event"), params: z.any() }),
      async (notification) => {
         const event = notification.params;
         
         // Handle Close
         if (event.action === "close" || event.action === "eidou:close") {
           console.log("Widget closed by user. Exiting...");
           process.exit(0);
         }
         
         // Handle Pokemon Selection
         if (typeof event.action === "string" && event.action.startsWith("select:")) {
             const pokemonId = event.action.split(":")[1];
             console.log(`Selected Pokemon: #${pokemonId}`);
         }
      }
    );

    // 5. Call show_widget
    console.log("Sending Widget JSON...");
    const result = await client.callTool({
      name: "show_widget",
      arguments: {
        widget_id: "06-pokedex",
        title: "Souta's Pokedex",
        ui: widget
      }
    });

    console.log("Result:", result);

  } catch (error) {
    exitCode = 1;
    console.error("Error:", error);
  } finally {
     if (shouldExit) {
       await transport.close().catch(() => {});
       process.exit(exitCode);
     }
  }

  if (Number.isFinite(holdMs) && holdMs > 0) {
    console.log(`Holding for ${holdMs}ms...`);
    await new Promise((r) => setTimeout(r, holdMs));
    await transport.close().catch(() => {});
    process.exit(exitCode);
  }

  console.log("Press Ctrl+C to exit.");
  process.on("SIGINT", async () => {
    await transport.close().catch(() => {});
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

main();
