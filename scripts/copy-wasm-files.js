#!/usr/bin/env node
/**
 * Copy ONNX Runtime WASM files to public directory
 * This ensures they're available for client-side loading
 */

const fs = require("fs");
const path = require("path");

const sourceDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "onnxruntime-web",
  "dist"
);
const targetDir = path.join(__dirname, "..", "public");

console.log("📦 Copying ONNX Runtime WASM files to /public...");
console.log(`   Source: ${sourceDir}`);
console.log(`   Target: ${targetDir}`);

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Find all .wasm AND .mjs files (JSEP needs both)
const filesToCopy = fs
  .readdirSync(sourceDir)
  .filter((file) => file.endsWith(".wasm") || file.endsWith(".mjs"));

if (filesToCopy.length === 0) {
  console.warn("⚠️  No WASM/MJS files found in onnxruntime-web/dist");
  console.warn("    This might indicate an installation issue");
  process.exit(1);
}

// Copy each file
let copiedCount = 0;
for (const file of filesToCopy) {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);

  try {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`   ✅ Copied: ${file}`);
    copiedCount++;
  } catch (error) {
    console.error(`   ❌ Failed to copy ${file}:`, error.message);
  }
}

console.log(
  `\n🎉 Successfully copied ${copiedCount}/${filesToCopy.length} ONNX files`
);
console.log("   ONNX Runtime will now use local files (no CDN required)\n");
