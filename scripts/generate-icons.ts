import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";

function renderSvgToPng(svgPath, outputPath, width, height) {
  const svg = readFileSync(svgPath, "utf-8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  writeFileSync(outputPath, pngBuffer);
  console.log(`  Generated: ${outputPath} (${width}x${height})`);
}

const iconsDir = "src-tauri/icons";

// 1. App icon source (1024x1024) for `tauri icon`
console.log("[1/3] Generating app-icon.png (1024x1024)...");
renderSvgToPng(`${iconsDir}/app-icon.svg`, `${iconsDir}/app-icon.png`, 1024, 1024);

// 2. macOS Tray Template icons (monochrome white)
console.log("[2/3] Generating tray-icon-Template.png (22x22)...");
renderSvgToPng(`${iconsDir}/tray-icon-Template.svg`, `${iconsDir}/tray-icon-Template.png`, 22, 22);

console.log("[3/3] Generating tray-icon-Template@2x.png (44x44)...");
renderSvgToPng(`${iconsDir}/tray-icon-Template.svg`, `${iconsDir}/tray-icon-Template@2x.png`, 44, 44);

console.log("\nAll source PNGs generated successfully!");
