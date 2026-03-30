const fs = require("fs");
const path = require("path");

const siteUrl = "https://www.powerpolysupplies.com";
const root = path.join(__dirname, "..");
const frontendDir = path.join(root, "frontend");
const productsPath = path.join(frontendDir, "data", "products.json");
const outputPath = path.join(frontendDir, "sitemap.xml");

const staticPages = [
  "index.html",
  "about.html",
  "contact.html",
  "products.html",
  "specials.html",
  "resources.html",
  "industries.html",
  "industry-dry-cleaners.html",
  "industry-laundromats.html",
  "industry-retail.html",
  "industry-uniform.html",
  "industry-commercial-laundry.html",
  "industry-healthcare.html",
  "blog.html",
  "garment-bags.html",
  "polybags.html",
  "hangers.html",
  "legal-privacy.html",
  "legal-terms.html",
  "legal-shipping.html"
];

const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
const productUrls = products.map((product)=> `${siteUrl}/product.html?slug=${encodeURIComponent(product.slug)}`);

const urls = [
  ...staticPages.map((file)=> `${siteUrl}/${file}`),
  ...productUrls
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url)=> `  <url><loc>${url}</loc></url>`),
  "</urlset>",
  ""
].join("\n");

fs.writeFileSync(outputPath, xml);
console.log(`Generated sitemap with ${urls.length} URLs at ${outputPath}`);
