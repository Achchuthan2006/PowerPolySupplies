const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "frontend", "css", "styles.css");
const outputPath = path.join(projectRoot, "frontend", "css", "styles.min.css");

function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>+~])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/@media\s*\(/g, "@media(")
    .replace(/@supports\s*\(/g, "@supports(")
    .trim();
}

const source = fs.readFileSync(sourcePath, "utf8");
const minified = minifyCss(source);

fs.writeFileSync(outputPath, `${minified}\n`, "utf8");

const sourceBytes = Buffer.byteLength(source, "utf8");
const outputBytes = Buffer.byteLength(minified, "utf8");
const saved = sourceBytes - outputBytes;
const pct = sourceBytes ? ((saved / sourceBytes) * 100).toFixed(1) : "0.0";

console.log(JSON.stringify({
  sourcePath,
  outputPath,
  sourceBytes,
  outputBytes,
  savedBytes: saved,
  savingsPercent: pct
}, null, 2));
