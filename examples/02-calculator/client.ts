import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { z } from "zod";
import baseWidget from "./widget.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Locate Binary
const BIN_PATHS = [
  process.env.EIDOU_BIN,
  resolve(__dirname, "../../src-tauri/target/release/eidou"),
  resolve(__dirname, "../../src-tauri/target/debug/eidou"),
  resolve(__dirname, "../../src-tauri/target/release/eidou.exe"),
  resolve(__dirname, "../../src-tauri/target/debug/eidou.exe"),
];
const eidouBin = BIN_PATHS.find(p => p && existsSync(p));
if (!eidouBin) { console.error("❌ Binary not found."); process.exit(1); }

// 2. Logic State
let display = "0";
let firstOperand: number | null = null;
let operator: string | null = null;
let waitingForSecondOperand = false;
let targetId: string | null = null;

// 3. Main
async function main() {
  // Filter env
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

  const client = new Client(
    { name: "eidou-example-02", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    console.log("🔌 Connecting...");
    await client.connect(transport);
    console.log("✅ Connected!");

    console.log("Creating Interactive Calculator (Real-time Mode)...");

    // Notification Handler
    client.setNotificationHandler(
      z.object({ method: z.literal("eidou/user_event"), params: z.any() }),
      async (notification) => {
         const event = notification.params;
         
         if (!event.action) return;
         const action = event.action;

         if (action.startsWith("calc:")) {
           processAction(action);
            await updateDisplay(client);
          } else if (action === "close" || action === "eidou:close") {
            console.log("❌ Window Closed by User");
            process.exit(0);
         }
       }
     );

    const result = await client.callTool({
      name: "show_widget",
      arguments: {
        widget_id: "02-calculator",
        title: "Neon Calc (Real-time)",
        ui: baseWidget
      }
    });

    // @ts-ignore
    const resultData = JSON.parse(result.content[0].text);
    targetId = resultData.target_id;
    console.log(`✅ Widget Created: ${targetId}`);
    console.log("Waiting for interaction (Press Ctrl+C to exit)...");

    // Keep alive
    await new Promise(() => {});

  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

async function updateDisplay(client: Client) {
    if (!targetId) return;

    // Clone widget and update display
    const updatedUi = JSON.parse(JSON.stringify(baseWidget));
    // Path: Field -> Shard -> Col -> Row -> Text
    // This path depends on widget.json structure. Assuming it hasn't changed.
    // Let's verify widget.json structure if possible, but based on previous code:
    // updatedUi.children[0].children[0].children[0].children[0].children[0].props.content = display;
    
    // Safety check path
    try {
        updatedUi.children[0].children[0].children[0].children[0].children[0].props.content = display;
    } catch (e) {
        console.error("Failed to update UI tree path", e);
    }

    await client.callTool({
        name: "show_widget",
        arguments: {
            widget_id: "02-calculator",
            ui: updatedUi
        }
    });
}

const processAction = (action: string) => {
  const key = action.replace("calc:", "");

  if (!isNaN(Number(key))) {
    if (waitingForSecondOperand) {
      display = key;
      waitingForSecondOperand = false;
    } else {
      display = display === "0" ? key : display + key;
    }
  } else if (key === ".") {
    if (!display.includes(".")) {
      display += ".";
      waitingForSecondOperand = false;
    }
  } else if (key === "clear") {
    display = "0";
    firstOperand = null;
    operator = null;
    waitingForSecondOperand = false;
  } else if (key === "back") {
    display = display.length > 1 ? display.slice(0, -1) : "0";
  } else if (["+", "-", "*", "/"].includes(key)) {
    firstOperand = parseFloat(display);
    operator = key;
    waitingForSecondOperand = true;
  } else if (key === "=") {
    if (operator && firstOperand !== null) {
      const secondOperand = parseFloat(display);
      let result = 0;
      switch (operator) {
        case "+": result = firstOperand + secondOperand; break;
        case "-": result = firstOperand - secondOperand; break;
        case "*": result = firstOperand * secondOperand; break;
        case "/": result = firstOperand / secondOperand; break;
      }
      display = String(result);
      firstOperand = null;
      operator = null;
      waitingForSecondOperand = true;
    }
  }
};

main();
