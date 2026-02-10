import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import widget from "./widget.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BIN_PATHS = [
  process.env.EIDOU_BIN,
  resolve(__dirname, "../../src-tauri/target/release/eidou"),
  resolve(__dirname, "../../src-tauri/target/debug/eidou"),
  resolve(__dirname, "../../src-tauri/target/release/eidou.exe"),
  resolve(__dirname, "../../src-tauri/target/debug/eidou.exe"),
];
const eidouBin = BIN_PATHS.find(p => p && existsSync(p));
if (!eidouBin) { console.error("Binary not found."); process.exit(1); }

async function main() {
  const env = { ...process.env };
  delete env.TAURI_DEV_SERVER_URL;
  delete env.TAURI_ENV_DEBUG;
  delete env.TAURI_DEBUG;
  delete env.TAURI_DEV;

  const transport = new StdioClientTransport({
    command: eidouBin!,
    args: ["--mcp-transport", "stdio"],
    env: { ...env, EIDOU_POOL_SIZE: "1" }
  });

  const client = new Client(
    { name: "eidou-example-09-chart", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    console.log("Connecting...");
    await client.connect(transport);
    console.log("Connected!");

    console.log("Showing Chart Variants (Line, Bar, Pie, Area)...");
    const result = await client.callTool({
      name: "show_widget_and_wait",
      arguments: {
        widget_id: "09-chart",
        title: "Chart Variants",
        ui: widget
      }
    });

    // @ts-ignore
    const resultData = JSON.parse(result.content[0].text);
    console.log("Session ended:", resultData.terminated_by);

  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }

  await transport.close().catch(() => {});
  process.exit(0);
}

main();
