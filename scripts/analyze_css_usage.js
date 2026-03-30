const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");
const cssPath = path.join(frontendDir, "css", "styles.css");

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, exts, files);
      continue;
    }
    if (exts.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function collectTokens(files) {
  const classes = new Set();
  const ids = new Set();
  const attrs = new Set();
  const tags = new Set();

  const classPattern = /class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g;
  const idPattern = /id\s*=\s*["'`]([^"'`]+)["'`]/g;
  const attrPattern = /\[([a-zA-Z0-9_-]+)(?:[~|^$*]?=)?/g;
  const tagPattern = /<([a-z][a-z0-9-]*)\b/gi;

  for (const filePath of files) {
    const source = read(filePath);

    for (const match of source.matchAll(classPattern)) {
      for (const token of match[1].split(/\s+/).filter(Boolean)) {
        classes.add(token.trim());
      }
    }
    for (const match of source.matchAll(idPattern)) {
      ids.add(match[1].trim());
    }
    for (const match of source.matchAll(attrPattern)) {
      attrs.add(match[1].trim());
    }
    for (const match of source.matchAll(tagPattern)) {
      tags.add(match[1].toLowerCase());
    }
  }

  return { classes, ids, attrs, tags };
}

function cleanSelector(selector) {
  return selector
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/::?[a-zA-Z-]+(?:\([^)]*\))?/g, "")
    .replace(/:where\(([^)]*)\)/g, "$1")
    .replace(/:is\(([^)]*)\)/g, "$1")
    .replace(/:not\(([^)]*)\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();
}

function selectorLooksUsed(selector, tokens) {
  const cleaned = cleanSelector(selector);
  if (!cleaned) return true;
  if (cleaned.includes(",")) {
    return cleaned.split(",").some((part) => selectorLooksUsed(part, tokens));
  }

  const classMatches = [...cleaned.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  const idMatches = [...cleaned.matchAll(/#([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  const tagMatches = [...cleaned.matchAll(/(^|[\s>+~(])([a-z][a-z0-9-]*)/gi)].map((m) => m[2].toLowerCase());

  if (classMatches.length && classMatches.some((name) => !tokens.classes.has(name))) {
    return false;
  }
  if (idMatches.length && idMatches.some((name) => !tokens.ids.has(name))) {
    return false;
  }
  if (tagMatches.length && tagMatches.every((name) => !tokens.tags.has(name))) {
    return false;
  }

  return true;
}

function extractTopLevelBlocks(css) {
  const blocks = [];
  let depth = 0;
  let start = 0;
  let selector = "";

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (char === "{") {
      if (depth === 0) {
        selector = css.slice(start, i).trim();
        start = i;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const block = css.slice(start, i + 1);
        blocks.push({ selector, block });
        start = i + 1;
      }
    }
  }

  return blocks;
}

const sourceFiles = walk(frontendDir, new Set([".html", ".js"]));
const tokens = collectTokens(sourceFiles);
const css = read(cssPath);
const blocks = extractTopLevelBlocks(css);

const maybeUnused = blocks
  .filter(({ selector }) => selector && !selector.startsWith("@"))
  .filter(({ selector }) => !selectorLooksUsed(selector, tokens))
  .map(({ selector }) => selector)
  .slice(0, 200);

console.log(JSON.stringify({
  sourceFiles: sourceFiles.length,
  classes: tokens.classes.size,
  ids: tokens.ids.size,
  maybeUnusedCount: maybeUnused.length,
  maybeUnused,
}, null, 2));
