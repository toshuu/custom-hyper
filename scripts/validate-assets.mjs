import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const manifestPath = process.argv[2] || "assets/manifests/spotify-every-mood.json";
const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];
const warnings = [];
const seenHashes = new Map();
const ids = new Set();

function imageInfo(file, format) {
  const b = fs.readFileSync(file);
  if (format === "png") {
    if (b.toString("hex",0,8) !== "89504e470d0a1a0a") throw new Error("invalid PNG signature");
    const width=b.readUInt32BE(16), height=b.readUInt32BE(20), colorType=b[25];
    return {width,height,alpha:colorType===4||colorType===6};
  }
  if (format === "gif") {
    if (!["GIF87a","GIF89a"].includes(b.toString("ascii",0,6))) throw new Error("invalid GIF signature");
    return {width:b.readUInt16LE(6),height:b.readUInt16LE(8),alpha:true};
  }
  throw new Error("unsupported image format: "+format);
}
for (const a of manifest.assets || []) {
  if (ids.has(a.id)) errors.push(a.id+": duplicate asset id");
  ids.add(a.id);
  if (!a.id || !a.path || !a.kind || !a.format || !a.width || !a.height) {
    errors.push((a.id||"unknown")+": missing required metadata");
    continue;
  }
  if (a.kind !== "brand_asset" && (!a.prompt || a.prompt.length < 20)) errors.push(a.id+": missing generation prompt");
  const file=path.resolve(root,a.path);
  if (!fs.existsSync(file)) {
    warnings.push(a.id+": missing file (generation pending): "+a.path);
    continue;
  }
  try {
    const info=imageInfo(file,a.format);
    if (info.width!==a.width || info.height!==a.height) errors.push(a.id+": expected "+a.width+"x"+a.height+", got "+info.width+"x"+info.height);
    if (a.alpha && !info.alpha) errors.push(a.id+": transparency required but file has no alpha channel");
    const hash=crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (seenHashes.has(hash)) warnings.push(a.id+": duplicate bytes with "+seenHashes.get(hash));
    else seenHashes.set(hash,a.id);
  } catch(e) { errors.push(a.id+": "+e.message); }
  if (!Array.isArray(a.scenes) || !a.scenes.length) errors.push(a.id+": no scene mapping");
}
for (const a of manifest.assets || []) {
  if (a.reference==="characterBible.referenceAsset" && !manifest.characterBible?.referenceAsset) errors.push(a.id+": character reference missing");
}
if (manifest.generationPolicy?.oneAssetPerGeneration!==true || manifest.generationPolicy?.noContactSheets!==true) errors.push("generation policy must prohibit multi-asset sheets");
console.log(JSON.stringify({manifest:manifestPath,total:(manifest.assets||[]).length,errors,warnings,ready:(manifest.assets||[]).filter(a=>fs.existsSync(path.resolve(root,a.path))).length},null,2));
if (errors.length) process.exitCode=1;
