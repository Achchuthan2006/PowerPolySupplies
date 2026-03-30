const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..", "frontend", "assets");
const QUALITY = 82;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

async function main(){
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  let converted = 0;

  for(const entry of entries){
    if(!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if(!SOURCE_EXTENSIONS.has(ext)) continue;

    const sourcePath = path.join(ROOT, entry.name);
    const targetPath = path.join(ROOT, `${path.basename(entry.name, ext)}.webp`);

    const image = sharp(sourcePath, { animated: false });
    const metadata = await image.metadata();
    const shouldResize = metadata.width && metadata.height;

    let pipeline = image.rotate();
    if(shouldResize){
      pipeline = pipeline.resize({
        width: Math.min(metadata.width, MAX_WIDTH),
        height: Math.min(metadata.height, MAX_HEIGHT),
        fit: "inside",
        withoutEnlargement: true
      });
    }

    const buffer = await pipeline.webp({
      quality: QUALITY,
      effort: 6,
      smartSubsample: true
    }).toBuffer();

    fs.writeFileSync(targetPath, buffer);
    converted += 1;
    const beforeKb = Math.round(fs.statSync(sourcePath).size / 1024);
    const afterKb = Math.round(buffer.length / 1024);
    console.log(`${entry.name} -> ${path.basename(targetPath)} (${beforeKb} KB -> ${afterKb} KB)`);
  }

  console.log(`Converted ${converted} image(s) to WebP in ${ROOT}`);
}

main().catch((error)=>{
  console.error(error);
  process.exit(1);
});
