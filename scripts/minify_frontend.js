const fs = require("fs");
const path = require("path");
const { minify: minifyJs } = require("terser");
const { minify: minifyHtml } = require("html-minifier-terser");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");
const cssDir = path.join(frontendDir, "css");
const jsDir = path.join(frontendDir, "js");

function walk(dir, extensions, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, extensions, out);
      continue;
    }
    if (extensions.has(path.extname(entry.name).toLowerCase())) {
      out.push(fullPath);
    }
  }
  return out;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function write(filePath, content) {
  fs.writeFileSync(filePath, `${content.replace(/\r?\n?$/, "")}\n`, "utf8");
}

function minifiedSibling(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(path.dirname(filePath), `${base}.min${ext}`);
}

function looksLikeJsx(source, filePath) {
  if (/[A-Z][^/\\]*\.js$/.test(filePath)) return true;
  return /return\s*\(\s*</.test(source) || /<html\b|<div\b|<Header\b|<Footer\b/.test(source);
}

function minifyCssSource(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>+~])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/@media\s*\(/g, "@media(")
    .replace(/@supports\s*\(/g, "@supports(")
    .trim();
}

async function buildCss() {
  const cssFiles = [
    ...walk(cssDir, new Set([".css"])),
    ...walk(frontendDir, new Set([".css"])).filter((file) => path.dirname(file) === frontendDir)
  ].filter((file) => !file.endsWith(".min.css"));
  const results = [];
  for (const filePath of cssFiles) {
    const source = read(filePath);
    const minified = minifyCssSource(source);
    const target = minifiedSibling(filePath);
    write(target, minified);
    results.push({
      file: path.relative(projectRoot, target),
      sourceBytes: Buffer.byteLength(source, "utf8"),
      outputBytes: Buffer.byteLength(minified, "utf8")
    });
  }
  return results;
}

async function buildJs() {
  const jsFiles = [
    ...walk(jsDir, new Set([".js"])).filter((file) => !file.endsWith(".min.js")),
    ...walk(frontendDir, new Set([".js"]))
      .filter((file) => path.dirname(file) === frontendDir)
      .filter((file) => !file.endsWith(".min.js"))
  ];

  const results = [];

  for (const filePath of jsFiles) {
    const source = read(filePath);
    const rel = path.relative(projectRoot, filePath);

    if (path.basename(filePath) === "sw.js") {
      const result = await minifyJs(source, {
        compress: true,
        mangle: true,
        format: { comments: false }
      });
      write(filePath, result.code || source);
      results.push({ file: rel, mode: "in_place" });
      continue;
    }

    const target = minifiedSibling(filePath);
    if (looksLikeJsx(source, filePath)) {
      const result = await esbuild.transform(source, {
        loader: "jsx",
        minify: true,
        legalComments: "none",
        format: "esm",
        target: "es2020"
      });
      write(target, result.code);
      results.push({ file: path.relative(projectRoot, target), mode: "esbuild" });
      continue;
    }

    const result = await minifyJs(source, {
      compress: true,
      mangle: true,
      format: { comments: false }
    });
    write(target, result.code || source);
    results.push({ file: path.relative(projectRoot, target), mode: "terser" });
  }

  return results;
}

function retargetAssetRefs(source) {
  let next = source;

  next = next.replace(/(\.\/css\/)([^"'`]+)\.css\b/g, (match, prefix, name) => {
    if (name.endsWith(".min")) return match;
    return `${prefix}${name}.min.css`;
  });

  next = next.replace(/(\.\/js\/)([^"'`]+)\.js\b/g, (match, prefix, name) => {
    if (name.endsWith(".min")) return match;
    const candidate = path.join(jsDir, `${name}.min.js`);
    return fs.existsSync(candidate) ? `${prefix}${name}.min.js` : match;
  });

  next = next.replace(/(["'])\.\/sw\.js\1/g, "\"./sw.js\"");
  return next;
}

function optimizeGoogleFontLinks(source) {
  return source.replace(
    /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link rel="stylesheet" href="([^"]+)">/g,
    (_match, href) => [
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      `<link rel="preload" as="style" href="${href}">`,
      `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">`,
      `<noscript><link rel="stylesheet" href="${href}"></noscript>`
    ].join("")
  );
}

async function buildHtml() {
  const htmlFiles = walk(frontendDir, new Set([".html"]));
  const results = [];

  for (const filePath of htmlFiles) {
    const source = read(filePath);
    const retargeted = optimizeGoogleFontLinks(retargetAssetRefs(source));
    const minified = await minifyHtml(retargeted, {
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      decodeEntities: true,
      keepClosingSlash: true,
      minifyCSS: true,
      minifyJS: true,
      processConditionalComments: false,
      removeAttributeQuotes: false,
      removeComments: true,
      removeEmptyAttributes: false,
      removeOptionalTags: false,
      sortAttributes: false,
      sortClassName: false
    });
    write(filePath, minified);
    results.push({
      file: path.relative(projectRoot, filePath),
      sourceBytes: Buffer.byteLength(source, "utf8"),
      outputBytes: Buffer.byteLength(minified, "utf8")
    });
  }

  return results;
}

function updateServiceWorkerCacheList() {
  const swPath = path.join(frontendDir, "sw.js");
  let source = read(swPath);
  source = retargetAssetRefs(source);
  write(swPath, source);
}

(async () => {
  const css = await buildCss();
  const js = await buildJs();
  updateServiceWorkerCacheList();
  const html = await buildHtml();

  console.log(JSON.stringify({
    css,
    js,
    htmlCount: html.length
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
