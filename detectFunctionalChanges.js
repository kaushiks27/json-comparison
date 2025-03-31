/**
 * JSON Functional Change Detection Script
 * =======================================
 * Compares JSON structures of connectors between 'previous' and 'current' folders,
 * detects structural and functional changes, and generates a human-readable report.
 */

const fs = require("fs");
const path = require("path");

// List of known subfolders to inspect in each connector
const SUBFOLDERS = ["actions", "auth", "events", "meta", "metadata"];

// Load and parse JSON file safely
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (e) {
    console.error(`❌ Error parsing ${filepath}: ${e.message}`);
    return null;
  }
}

// Recursively collect all .json files in a given folder
function collectJSONFiles(basePath) {
  if (!fs.existsSync(basePath)) return {};
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  const jsonFiles = {};

  for (const entry of entries) {
    const entryPath = path.join(basePath, entry.name);
    if (entry.isFile() && entry.name.endsWith(".json")) {
      jsonFiles[entry.name] = loadJSON(entryPath);
    }
  }

  return jsonFiles;
}

// Deep diff utility (shallow value compare for now)
function diffObjects(oldObj, newObj, pathPrefix = "") {
  const changes = [];

  const keys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ]);
  for (const key of keys) {
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];

    if (oldVal === undefined) {
      changes.push({ type: "added", path: fullPath, newVal });
    } else if (newVal === undefined) {
      changes.push({ type: "removed", path: fullPath, oldVal });
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ type: "modified", path: fullPath, oldVal, newVal });
    }
  }

  return changes;
}

// Main comparison logic
function compareConnectors(prevPath, currPath) {
  const results = [];

  const prevConnectors = fs.readdirSync(prevPath);
  const currConnectors = fs.readdirSync(currPath);

  const allConnectors = new Set([...prevConnectors, ...currConnectors]);

  for (const connector of allConnectors) {
    const report = { connector, changes: [] };
    const prevDir = path.join(prevPath, connector);
    const currDir = path.join(currPath, connector);

    for (const subfolder of SUBFOLDERS) {
      const prevSub = path.join(prevDir, subfolder);
      const currSub = path.join(currDir, subfolder);

      const prevFiles = collectJSONFiles(prevSub);
      const currFiles = collectJSONFiles(currSub);

      const allFiles = new Set([
        ...Object.keys(prevFiles),
        ...Object.keys(currFiles),
      ]);
      for (const file of allFiles) {
        const oldJson = prevFiles[file];
        const newJson = currFiles[file];

        if (!oldJson) {
          report.changes.push({
            type: "file-added",
            file: `${subfolder}/${file}`,
            category: subfolder,
          });
        } else if (!newJson) {
          report.changes.push({
            type: "file-removed",
            file: `${subfolder}/${file}`,
            category: subfolder,
          });
        } else {
          const diffs = diffObjects(
            oldJson,
            newJson,
            `${subfolder}/${file.replace(".json", "")}`
          );
          report.changes.push(
            ...diffs.map((d) => ({ ...d, category: subfolder }))
          );
        }
      }

      if (!fs.existsSync(prevSub) && fs.existsSync(currSub)) {
        report.changes.push({
          type: "folder-added",
          folder: subfolder,
          category: subfolder,
        });
      } else if (fs.existsSync(prevSub) && !fs.existsSync(currSub)) {
        report.changes.push({
          type: "folder-removed",
          folder: subfolder,
          category: subfolder,
        });
      }
    }

    results.push(report);
  }

  return results;
}

// Generate markdown report
function generateReport(reports) {
  const lines = ["# 📋 Functional Change Report\n"];

  for (const { connector, changes } of reports) {
    lines.push(`\n## 🔌 Connector: \`${connector}\``);

    if (changes.length === 0) {
      lines.push("- No changes detected.");
      continue;
    }

    // Generate a summary
    const summary = [];
    const categoryMap = {};

    for (const change of changes) {
      const cat = change.category || "general";
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(change);

      if (change.type === "file-added") summary.push(`🆕 ${change.file}`);
      if (change.type === "file-removed") summary.push(`🗑️ ${change.file}`);
      if (change.type === "folder-added")
        summary.push(`📁 New folder: ${change.folder}`);
      if (change.type === "folder-removed")
        summary.push(`📁 Removed folder: ${change.folder}`);
      if (change.type === "modified" && change.path.includes("auth"))
        summary.push(`🔐 Auth change`);
      if (change.type === "modified" && change.path.includes("outputFields"))
        summary.push(`📦 Output structure changed`);
    }

    lines.push(`\n### 🧾 Summary of Changes`);
    for (const item of [...new Set(summary)]) {
      lines.push(`- ${item}`);
    }

    // Grouped detailed changes
    for (const [category, catChanges] of Object.entries(categoryMap)) {
      lines.push(
        `\n### 📂 ${
          category.charAt(0).toUpperCase() + category.slice(1)
        } Changes`
      );

      for (const change of catChanges) {
        if (change.type === "file-added") {
          lines.push(`🆕 New file: \`${change.file}\``);
        } else if (change.type === "file-removed") {
          lines.push(`🗑️ Removed file: \`${change.file}\``);
        } else if (change.type === "folder-added") {
          lines.push(`📁 New folder added: \`${change.folder}/\``);
        } else if (change.type === "folder-removed") {
          lines.push(`📁 Folder removed: \`${change.folder}/\``);
        } else if (change.type === "added") {
          lines.push(
            `➕ Added \`${change.path}\` with value \`${JSON.stringify(
              change.newVal
            )}\``
          );
        } else if (change.type === "removed") {
          lines.push(
            `❌ Removed \`${change.path}\` (was \`${JSON.stringify(
              change.oldVal
            )}\`)`
          );
        } else if (change.type === "modified") {
          lines.push(
            `✏️ Changed \`${change.path}\`: \`${JSON.stringify(
              change.oldVal
            )}\` → \`${JSON.stringify(change.newVal)}\``
          );
        }
      }
    }
  }

  fs.writeFileSync("functional-change-report.md", lines.join("\n"), "utf-8");
  console.log("✅ Report generated: functional-change-report.md");
}

// Entry point
function run() {
  const prevPath = path.join(__dirname, "connectors", "previous");
  const currPath = path.join(__dirname, "connectors", "current");

  const reports = compareConnectors(prevPath, currPath);
  generateReport(reports);
}

run();
