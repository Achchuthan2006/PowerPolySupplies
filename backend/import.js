import fs from "fs";

const frontendProducts = JSON.parse(fs.readFileSync("../frontend/data/products.json","utf-8"));
const db = JSON.parse(fs.readFileSync("./db.json","utf-8"));

db.products = frontendProducts.map(p=>({
  id:p.id,
  name:p.name,
  slug:p.slug,
  category:p.category,
  priceCents:p.priceCents,
  currency:p.currency,
  stock:p.stock,
  image:p.image,
  description:p.description,
  special: !!p.special
}));

fs.writeFileSync("./db.json", JSON.stringify(db,null,2));
console.log("Imported products:", db.products.length);
