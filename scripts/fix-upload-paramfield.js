const fs = require("fs");
const files = ["en/upload-file.mdx", "pt/upload-file.mdx", "es/upload-file.mdx"];
for (const f of files) {
  let c = fs.readFileSync(f, "utf8");
  const updated = c
    .replace(/body="file"/g, 'form="file"')
    .replace(/body="process"/g, 'form="process"');
  if (updated !== c) {
    fs.writeFileSync(f, updated, "utf8");
    console.log("fixed:", f);
  }
}
