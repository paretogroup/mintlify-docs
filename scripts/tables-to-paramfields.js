/**
 * Converts markdown parameter tables in API endpoint MDX files
 * into Mintlify <ParamField> components so the Try it playground
 * can read and render the form fields.
 *
 * Sections converted (### level headings only):
 *   "Headers"          → <ParamField header="...">
 *   "Path Parameters"  → <ParamField path="...">
 *   "Query Parameters" → <ParamField query="...">
 *   "Request Body"     → <ParamField body="...">
 *
 * Everything else (CodeGroup, Notes, #### sub-sections, Response) is kept as-is.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const SECTION_TYPE_MAP = {
  // English
  "headers": "header",
  "header": "header",
  "path parameters": "path",
  "path parameter": "path",
  "query parameters": "query",
  "query parameter": "query",
  "request body": "body",
  "body parameters": "body",
  "body": "body",
  // Portuguese (PT)
  "cabeçalhos": "header",
  "parâmetros de caminho": "path",
  "parâmetros de consulta": "query",
  "corpo da requisição": "body",
  // Spanish (ES)
  "encabezados": "header",
  "parámetros de ruta": "path",
  "parámetros de consulta": "query",
  "cuerpo de la solicitud": "body",
};

function getSectionType(headingLine) {
  const norm = headingLine.replace(/^#+\s*/, "").replace(/\*+/g, "").trim().toLowerCase();
  for (const [key, val] of Object.entries(SECTION_TYPE_MAP)) {
    if (norm.includes(key)) return val;
  }
  return null;
}

function cleanCell(raw) {
  return raw.replace(/\*+/g, "").replace(/`([^`]+)`/g, "$1").trim();
}

function isRequired(rawReq) {
  const r = cleanCell(rawReq).toLowerCase();
  // EN: yes / PT: sim / ES: sí / generic: true, required
  return r === "yes" || r === "sim" || r === "sí" || r === "si" || r === "true" || r === "required";
}

/**
 * Parse a markdown table (array of lines starting with |) into row objects.
 * Skips the header row and the separator row.
 */
function parseTable(tableLines) {
  const rows = [];
  let separatorSeen = false;

  for (const line of tableLines) {
    const t = line.trim();
    if (!t.startsWith("|")) break;

    // Separator row: | :--- | :--- | ...
    if (/^\|[\s:|-]+\|$/.test(t)) {
      separatorSeen = true;
      continue;
    }

    // Skip header row (before separator)
    if (!separatorSeen) continue;

    const cells = t.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;

    const name = cleanCell(cells[0]);
    const type = cleanCell(cells[1]) || "string";
    const req = cells.length >= 3 ? isRequired(cells[2]) : false;
    const desc = cells.slice(3).map(cleanCell).join(" ").trim();

    if (name) rows.push({ name, type, required: req, description: desc });
  }

  return rows;
}

function renderParamFields(sectionType, rows) {
  return rows
    .map((row) => {
      const reqAttr = row.required ? " required" : "";
      const inner = row.description ? `\n  ${row.description}\n` : "\n";
      return `<ParamField ${sectionType}="${row.name}" type="${row.type}"${reqAttr}>${inner}</ParamField>`;
    })
    .join("\n");
}

function processFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");

  // Only touch files that have api: in frontmatter
  if (!raw.match(/^---[\s\S]*?^api:/m)) return false;

  const lines = raw.split(/\r?\n/);
  const out = [];
  let i = 0;
  let changed = false;

  while (i < lines.length) {
    const line = lines[i];

    // Look for ### headings that are param sections
    if (/^### /.test(line.trim())) {
      const sectionType = getSectionType(line);

      if (sectionType) {
        out.push(line); // Keep the heading
        i++;

        // Collect and skip blank lines between heading and table
        const blanks = [];
        while (i < lines.length && lines[i].trim() === "") {
          blanks.push(lines[i]);
          i++;
        }

        // If next line starts a table, convert it
        if (i < lines.length && lines[i].trim().startsWith("|")) {
          const tableLines = [];
          while (i < lines.length && lines[i].trim().startsWith("|")) {
            tableLines.push(lines[i]);
            i++;
          }

          const rows = parseTable(tableLines);
          if (rows.length > 0) {
            out.push(""); // blank line after heading
            out.push(renderParamFields(sectionType, rows));
            changed = true;
            // Don't add the blanks back — they were between heading and old table
          } else {
            // Couldn't parse — restore original
            out.push(...blanks, ...tableLines);
          }
        } else {
          // No table after heading — restore blanks
          out.push(...blanks);
        }
        continue;
      }
    }

    out.push(line);
    i++;
  }

  if (changed) {
    fs.writeFileSync(filePath, out.join("\n"), "utf8");
    return true;
  }
  return false;
}

// Walk all MDX files (en, pt, es + root orphans)
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

const files = walk(ROOT);
let updated = 0;
let skipped = 0;

for (const f of files) {
  if (processFile(f)) {
    console.log(`✓ ${path.relative(ROOT, f).replace(/\\/g, "/")}`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nUpdated: ${updated} | Unchanged: ${skipped}`);
