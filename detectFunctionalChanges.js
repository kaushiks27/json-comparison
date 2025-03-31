/**
 * Enhanced JSON Functional Change Detection Script
 * ===============================================
 * Compares JSON structures of connectors between 'previous' and 'current' folders,
 * detects structural and functional changes, and generates a human-readable report
 * with collapsible sections, visual diffs, and priority-based grouping.
 */

const fs = require("fs");
const path = require("path");

// List of known subfolders to inspect in each connector
const SUBFOLDERS = ["actions", "auth", "events", "meta", "metadata"];

// Priority levels for different types of changes
const PRIORITY_LEVELS = {
  P0: "Critical", // Authentication, security-related fields
  P1: "Major", // New actions, removed features, altered structure
  P2: "Minor", // Description updates, cosmetic changes
};

// Priority mapping rules
const PRIORITY_RULES = {
  // P0 - Critical changes
  "auth/": "P0",
  security: "P0",
  permissions: "P0",
  authentication: "P0",
  authorization: "P0",

  // P1 - Major changes
  "actions/": "P1",
  "events/": "P1",
  "file-added": "P1",
  "file-removed": "P1",
  "folder-added": "P1",
  "folder-removed": "P1",
  endpoint: "P1",
  httpMethod: "P1",
  inputFields: "P1",
  outputFields: "P1",
  trigger: "P1",
  payload: "P1",

  // Default to P2 - Minor changes
  default: "P2",
};

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

// Determine priority level based on change type and path
function determinePriority(change) {
  // Check exact matches first
  if (change.category === "auth") return "P0";

  // Check for pattern matches in path or content
  for (const [pattern, priority] of Object.entries(PRIORITY_RULES)) {
    if (pattern === "default") continue;

    // Check if the pattern appears in the path or type
    if (
      (change.path && change.path.includes(pattern)) ||
      (change.file && change.file.includes(pattern)) ||
      (change.folder && change.folder.includes(pattern)) ||
      (change.type && change.type.includes(pattern))
    ) {
      return priority;
    }

    // For modified changes, check if old or new values contain critical keywords
    if (
      change.type === "modified" &&
      ((typeof change.oldVal === "string" && change.oldVal.includes(pattern)) ||
        (typeof change.newVal === "string" && change.newVal.includes(pattern)))
    ) {
      return priority;
    }
  }

  // Default to P2 - Minor changes
  return PRIORITY_RULES.default;
}

// Get emoji for change type
function getChangeEmoji(type, priority) {
  switch (type) {
    case "file-added":
    case "folder-added":
    case "added":
      return "➕";
    case "file-removed":
    case "folder-removed":
    case "removed":
      return "❌";
    case "modified":
      return "✏️";
    default:
      // Use priority-based emoji for other cases
      if (priority === "P0") return "🚨";
      if (priority === "P1") return "⚠️";
      return "ℹ️";
  }
}

// Format JSON value for display (with truncation for large values)
function formatValue(value, truncateLength = 80) {
  const json = JSON.stringify(value);
  if (json.length <= truncateLength) return json;
  return json.substring(0, truncateLength) + "...";
}

// Deep diff utility with improved comparison
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

    // Handle missing values
    if (oldVal === undefined) {
      changes.push({ type: "added", path: fullPath, newVal });
    } else if (newVal === undefined) {
      changes.push({ type: "removed", path: fullPath, oldVal });
    }
    // Handle different types
    else if (typeof oldVal !== typeof newVal) {
      changes.push({ type: "modified", path: fullPath, oldVal, newVal });
    }
    // Recursively compare objects
    else if (
      typeof oldVal === "object" &&
      oldVal !== null &&
      typeof newVal === "object" &&
      newVal !== null &&
      !Array.isArray(oldVal) &&
      !Array.isArray(newVal)
    ) {
      changes.push(...diffObjects(oldVal, newVal, fullPath));
    }
    // Special handling for arrays (avoid false positives for reordered arrays)
    else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      if (JSON.stringify(oldVal.sort()) !== JSON.stringify(newVal.sort())) {
        changes.push({ type: "modified", path: fullPath, oldVal, newVal });
      }
    }
    // Simple value comparison
    else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ type: "modified", path: fullPath, oldVal, newVal });
    }
  }

  return changes;
}

// Main comparison logic
function compareConnectors(prevPath, currPath) {
  const results = [];

  // Ensure directories exist
  if (!fs.existsSync(prevPath)) {
    console.error(`❌ Previous directory not found: ${prevPath}`);
    return results;
  }

  if (!fs.existsSync(currPath)) {
    console.error(`❌ Current directory not found: ${currPath}`);
    return results;
  }

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
            priority: determinePriority({
              type: "file-added",
              file: `${subfolder}/${file}`,
              category: subfolder,
            }),
          });
        } else if (!newJson) {
          report.changes.push({
            type: "file-removed",
            file: `${subfolder}/${file}`,
            category: subfolder,
            priority: determinePriority({
              type: "file-removed",
              file: `${subfolder}/${file}`,
              category: subfolder,
            }),
          });
        } else {
          const diffs = diffObjects(
            oldJson,
            newJson,
            `${subfolder}/${file.replace(".json", "")}`
          );

          // Add category and priority to each diff
          const enhancedDiffs = diffs.map((diff) => ({
            ...diff,
            category: subfolder,
            priority: determinePriority({
              ...diff,
              category: subfolder,
            }),
          }));

          report.changes.push(...enhancedDiffs);
        }
      }

      if (!fs.existsSync(prevSub) && fs.existsSync(currSub)) {
        report.changes.push({
          type: "folder-added",
          folder: subfolder,
          category: subfolder,
          priority: determinePriority({
            type: "folder-added",
            folder: subfolder,
            category: subfolder,
          }),
        });
      } else if (fs.existsSync(prevSub) && !fs.existsSync(currSub)) {
        report.changes.push({
          type: "folder-removed",
          folder: subfolder,
          category: subfolder,
          priority: determinePriority({
            type: "folder-removed",
            folder: subfolder,
            category: subfolder,
          }),
        });
      }
    }

    results.push(report);
  }

  return results;
}

// Generate enhanced markdown report with collapsible sections, visual diffs, and priority grouping
function generateReport(reports) {
  const lines = ["# 📋 Enhanced Functional Change Report\n"];

  // Count changes by priority
  const priorityCounts = { P0: 0, P1: 0, P2: 0 };
  const allCriticalChanges = [];

  // Calculate priority counts and collect critical changes
  for (const { connector, changes } of reports) {
    for (const change of changes) {
      priorityCounts[change.priority] =
        (priorityCounts[change.priority] || 0) + 1;

      // Collect critical and major changes for executive summary
      if (change.priority === "P0" || change.priority === "P1") {
        allCriticalChanges.push({
          connector,
          ...change,
        });
      }
    }
  }

  // Add priority counts summary
  lines.push(
    `> **Change Summary:** ${priorityCounts.P0} Critical, ${priorityCounts.P1} Major, ${priorityCounts.P2} Minor changes\n`
  );

  // Create executive summary if there are any critical changes
  if (allCriticalChanges.length > 0) {
    lines.push(`## 🚨 Executive Summary\n`);
    lines.push(`<details open>`);
    lines.push(
      `<summary><strong>Critical and Major Changes (${allCriticalChanges.length})</strong></summary>\n`
    );

    // Sort by priority, then connector
    allCriticalChanges.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === "P0" ? -1 : 1;
      }
      return a.connector.localeCompare(b.connector);
    });

    // Group by connector
    const criticalByConnector = {};
    for (const change of allCriticalChanges) {
      if (!criticalByConnector[change.connector]) {
        criticalByConnector[change.connector] = [];
      }
      criticalByConnector[change.connector].push(change);
    }

    // List critical changes by connector
    for (const [connector, changes] of Object.entries(criticalByConnector)) {
      lines.push(`### ${connector}\n`);

      for (const change of changes) {
        const emoji = getChangeEmoji(change.type, change.priority);
        const priority = change.priority === "P0" ? "🔴" : "🟠";

        // Create a unique anchor for linking
        const anchor = `${connector}-${change.category}-${change.type}-${
          change.path || change.file || change.folder
        }`.replace(/[^\w-]/g, "-");

        let description;
        if (change.type === "file-added") {
          description = `Added file: <code>${change.file}</code>`;
        } else if (change.type === "file-removed") {
          description = `Removed file: <code>${change.file}</code>`;
        } else if (change.type === "folder-added") {
          description = `Added folder: <code>${change.folder}/</code>`;
        } else if (change.type === "folder-removed") {
          description = `Removed folder: <code>${change.folder}/</code>`;
        } else if (change.type === "added") {
          description = `Added <code>${
            change.path
          }</code> with value <code>${formatValue(change.newVal)}</code>`;
        } else if (change.type === "removed") {
          description = `Removed <code>${
            change.path
          }</code> (was <code>${formatValue(change.oldVal)}</code>)`;
        } else if (change.type === "modified") {
          description = `Changed <code>${change.path}</code>`;
        }

        lines.push(
          `- ${priority} ${emoji} ${description} <a href="#${anchor}">(details)</a>`
        );
      }

      lines.push("");
    }

    lines.push(`</details>\n`);
  }

  // Detailed changes by connector
  for (const { connector, changes } of reports) {
    // Skip connectors with no changes
    if (changes.length === 0) continue;

    // Determine if this connector has any critical changes
    const hasCritical = changes.some((c) => c.priority === "P0");

    // Create a collapsible section for the connector (open by default if has critical changes)
    lines.push(`## 🔌 Connector: \`${connector}\``);
    lines.push(`<details${hasCritical ? " open" : ""}>`);
    lines.push(
      `<summary><strong>Changes (${changes.length})</strong></summary>\n`
    );

    // Generate a summary of changes
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

    lines.push(`### 🧾 Summary of Changes`);
    for (const item of [...new Set(summary)]) {
      lines.push(`- ${item}`);
    }

    // Define priority icons for visual reference
    const priorityIcons = {
      P0: "🔴 Critical",
      P1: "🟠 Major",
      P2: "🟢 Minor",
    };

    // Group changes by priority
    const changesByPriority = {
      P0: [],
      P1: [],
      P2: [],
    };

    // Populate priority groups
    for (const cat of Object.values(categoryMap)) {
      for (const change of cat) {
        changesByPriority[change.priority].push(change);
      }
    }

    // Show changes grouped by priority with collapsible sections
    for (const priority of ["P0", "P1", "P2"]) {
      const priorityChanges = changesByPriority[priority];
      if (priorityChanges.length === 0) continue;

      // Open by default only for critical changes
      const openByDefault = priority === "P0" ? " open" : "";

      lines.push(
        `\n### ${priorityIcons[priority]} Changes (${priorityChanges.length})`
      );
      lines.push(`<details${openByDefault}>`);
      lines.push(
        `<summary><strong>${PRIORITY_LEVELS[priority]} Changes</strong></summary>\n`
      );

      // Group by category within priority
      const catMap = {};
      for (const change of priorityChanges) {
        const cat = change.category || "general";
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(change);
      }

      for (const [category, catChanges] of Object.entries(catMap)) {
        const catTitle = category.charAt(0).toUpperCase() + category.slice(1);

        // Only create a new collapsible section if we have multiple categories
        if (Object.keys(catMap).length > 1) {
          lines.push(`#### 📂 ${catTitle}`);
        }

        for (const change of catChanges) {
          const emoji = getChangeEmoji(change.type, change.priority);

          // Create an anchor for deep linking
          const anchor = `${connector}-${change.category}-${change.type}-${
            change.path || change.file || change.folder
          }`.replace(/[^\w-]/g, "-");
          lines.push(`<a id="${anchor}"></a>`);

          if (change.type === "file-added") {
            lines.push(`${emoji} New file: \`${change.file}\``);
          } else if (change.type === "file-removed") {
            lines.push(`${emoji} Removed file: \`${change.file}\``);
          } else if (change.type === "folder-added") {
            lines.push(`${emoji} New folder added: \`${change.folder}/\``);
          } else if (change.type === "folder-removed") {
            lines.push(`${emoji} Folder removed: \`${change.folder}/\``);
          } else if (change.type === "added") {
            lines.push(`${emoji} Added \`${change.path}\` with value:`);
            lines.push(
              `\`\`\`json\n${JSON.stringify(change.newVal, null, 2)}\n\`\`\``
            );
          } else if (change.type === "removed") {
            lines.push(`${emoji} Removed \`${change.path}\` (was):`);
            lines.push(
              `\`\`\`json\n${JSON.stringify(change.oldVal, null, 2)}\n\`\`\``
            );
          } else if (change.type === "modified") {
            lines.push(`${emoji} Changed \`${change.path}\`:`);
            lines.push(`<table>`);
            lines.push(`<tr><th>Before</th><th>After</th></tr>`);
            lines.push(`<tr><td>`);

            // Old value with syntax highlighting
            lines.push(
              `\`\`\`json\n${JSON.stringify(change.oldVal, null, 2)}\n\`\`\``
            );

            lines.push(`</td><td>`);

            // New value with syntax highlighting
            lines.push(
              `\`\`\`json\n${JSON.stringify(change.newVal, null, 2)}\n\`\`\``
            );

            lines.push(`</td></tr>`);
            lines.push(`</table>`);
          }

          lines.push("");
        }
      }

      lines.push(`</details>`);
    }

    lines.push(`</details>\n`);
  }

  fs.writeFileSync("functional-change-report.md", lines.join("\n"), "utf-8");
  console.log("✅ Enhanced report generated: functional-change-report.md");
}

// Entry point
function run() {
  console.log("🔍 Starting enhanced functional change detection...");

  const prevPath = path.join(__dirname, "connectors", "previous");
  const currPath = path.join(__dirname, "connectors", "current");

  // Validate paths
  if (!fs.existsSync(prevPath)) {
    console.error(`❌ Previous directory not found: ${prevPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(currPath)) {
    console.error(`❌ Current directory not found: ${currPath}`);
    process.exit(1);
  }

  console.log(`📂 Analyzing connectors in ${prevPath} and ${currPath}...`);
  const reports = compareConnectors(prevPath, currPath);

  console.log(`📝 Generating enhanced report...`);
  generateReport(reports);

  console.log(`✨ Process complete!`);
}

// Execute the script
run();
