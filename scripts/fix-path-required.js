const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !["node_modules", ".git", "scripts"].includes(e.name)) {
      walk(p, acc);
    } else if (e.isFile() && e.name.endsWith(".mdx")) {
      acc.push(p);
    }
  }
  return acc;
}

let fixed = 0;
for (const f of walk(ROOT)) {
  const raw = fs.readFileSync(f, "utf8");
  if (!raw.includes("<ParamField path=")) continue;

  // Add required to path ParamFields that don't already have it
  const updated = raw.replace(
    /<ParamField path="([^"]+)" type="([^"]+)">/g,
    '<ParamField path="$1" type="$2" required>'
  );

  if (updated !== raw) {
    fs.writeFileSync(f, updated, "utf8");
    console.log("fixed:", path.relative(ROOT, f).replace(/\\/g, "/"));
    fixed++;
  }
}
console.log("Total fixed:", fixed);
