import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const EXAMPLES_DIR = resolve("examples");
const SPEC_ROOT = resolve("specification");

async function getLatestSpecDir(): Promise<string> {
  const entries = await readdir(SPEC_ROOT, { withFileTypes: true });
  const versionDirs = entries
    .filter((ent) => ent.isDirectory() && ent.name.startsWith("v"))
    .map((ent) => ent.name);

  if (versionDirs.length === 0) {
    throw new Error("No specification versions found.");
  }

  // Parse versions (v0_1 -> [0, 1]) and sort
  versionDirs.sort((a, b) => {
    const parse = (s: string) => s.substring(1).split("_").map(Number);
    const [majA, minA] = parse(a);
    const [majB, minB] = parse(b);
    if (majA !== majB) return majB - majA;
    return minB - minA;
  });

  return join(SPEC_ROOT, versionDirs[0]);
}

async function loadSchemas(specDir: string, ajv: Ajv) {
  const jsonDir = join(specDir, "json");
  const files = await readdir(jsonDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  for (const file of jsonFiles) {
    const content = await readFile(join(jsonDir, file), "utf-8");
    const schema = JSON.parse(content);
    ajv.addSchema(schema);
  }
}

async function validateExamples() {
  const latestSpecDir = await getLatestSpecDir();
  console.log(`Using specification: ${latestSpecDir}`);

  const ajv = new Ajv({ 
    allErrors: true,
    strict: false,
    discriminator: true
  });
  addFormats(ajv);

  await loadSchemas(latestSpecDir, ajv);

  const validateSchema = ajv.getSchema("https://eidou.com/root.json");
  if (!validateSchema) {
    throw new Error("Could not find root schema (https://eidou.com/root.json)");
  }

  let hasError = false;

  async function checkFile(filePath: string) {
    try {
      const content = await readFile(filePath, "utf-8");
      const json = JSON.parse(content);
      const valid = validateSchema!(json);
      if (!valid) {
        console.error(`[FAIL] ${filePath}:`);
        validateSchema!.errors?.forEach((err) => {
          console.error(`  - ${err.instancePath} ${err.message}`);
        });
        hasError = true;
      }
    } catch (err: any) {
      console.error(`Error parsing ${filePath}: ${err.message}`);
      hasError = true;
    }
  }

  async function scanDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && entry.name === "widget.json") {
        await checkFile(fullPath);
      }
    }
  }

  console.log("Checking examples for EUIP compliance...");
  await scanDir(EXAMPLES_DIR);

  if (hasError) {
    console.error("Validation failed.");
    process.exit(1);
  } else {
    console.log("All examples passed.");
    process.exit(0);
  }
}

validateExamples().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
