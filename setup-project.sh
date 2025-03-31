#!/bin/bash

# Script to set up the directory structure and files for the enhanced change detection project

# Create the directory structure
mkdir -p src/report-generators src/utils templates/scripts

# Create the main entry point
cat > src/index.js << 'EOF'
/**
 * Advanced JSON Functional Change Detection
 * Main entry point
 */

const path = require('path');
const { compareConnectors } = require('./comparator');
const { generateHTMLReport } = require('./report-generators/html-report');
const { generateMarkdownReport } = require('./report-generators/markdown-report');
const { generateJSONReport } = require('./report-generators/json-report');

// Paths to connector directories
const prevPath = path.join(__dirname, '..', 'connectors', 'previous');
const currPath = path.join(__dirname, '..', 'connectors', 'current');

async function run() {
  console.log("🔍 Starting functional change detection...");
  
  // Compare connectors
  console.log(`📂 Analyzing connectors in ${prevPath} and ${currPath}...`);
  const comparisonResult = await compareConnectors(prevPath, currPath);
  
  // Generate reports
  console.log("📝 Generating reports...");
  
  // Generate HTML report
  await generateHTMLReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.html'));
  console.log("✅ HTML report generated: functional-change-report.html");
  
  // Generate Markdown report
  await generateMarkdownReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.md'));
  console.log("✅ Markdown report generated: functional-change-report.md");
  
  // Generate JSON report
  await generateJSONReport(comparisonResult, path.join(__dirname, '..', 'functional-change-data.json'));
  console.log("✅ JSON data generated: functional-change-data.json");
  
  console.log("✨ Process complete!");
}

// Run the program
run().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});
EOF

# Create the comparator module
cat > src/comparator.js << 'EOF'
/**
 * JSON comparison module
 * Compares JSON structures between two connector versions
 */

const fs = require('fs');
const path = require('path');
const { loadJSON, collectJSONFiles } = require('./utils/file-utils');
const { determinePriority } = require('./prioritizer');

// List of known subfolders to inspect in each connector
const SUBFOLDERS = ["actions", "auth", "events", "meta", "metadata"];

/**
 * Deeply compares two objects and returns the differences
 * @param {Object} oldObj - The old object
 * @param {Object} newObj - The new object
 * @param {string} pathPrefix - Prefix for the property path
 * @returns {Array} - Array of change objects
 */
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
    else if (typeof oldVal === "object" && oldVal !== null && 
             typeof newVal === "object" && newVal !== null &&
             !Array.isArray(oldVal) && !Array.isArray(newVal)) {
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

/**
 * Compares connectors between previous and current versions
 * @param {string} prevPath - Path to previous connector directory
 * @param {string} currPath - Path to current connector directory
 * @returns {Array} - Comparison results for each connector
 */
async function compareConnectors(prevPath, currPath) {
  // Validate paths
  if (!fs.existsSync(prevPath)) {
    throw new Error(`Previous directory not found: ${prevPath}`);
  }
  
  if (!fs.existsSync(currPath)) {
    throw new Error(`Current directory not found: ${currPath}`);
  }

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
            priority: determinePriority({ 
              type: "file-added", 
              file: `${subfolder}/${file}`, 
              category: subfolder 
            })
          });
        } else if (!newJson) {
          report.changes.push({
            type: "file-removed",
            file: `${subfolder}/${file}`,
            category: subfolder,
            priority: determinePriority({ 
              type: "file-removed", 
              file: `${subfolder}/${file}`, 
              category: subfolder 
            })
          });
        } else {
          const diffs = diffObjects(
            oldJson,
            newJson,
            `${subfolder}/${file.replace(".json", "")}`
          );
          
          // Add category and priority to each diff
          const enhancedDiffs = diffs.map(diff => ({
            ...diff,
            category: subfolder,
            priority: determinePriority({
              ...diff,
              category: subfolder
            })
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
            category: subfolder 
          })
        });
      } else if (fs.existsSync(prevSub) && !fs.existsSync(currSub)) {
        report.changes.push({
          type: "folder-removed",
          folder: subfolder,
          category: subfolder,
          priority: determinePriority({ 
            type: "folder-removed", 
            folder: subfolder, 
            category: subfolder 
          })
        });
      }
    }

    results.push(report);
  }

  return results;
}

module.exports = { compareConnectors, diffObjects };
EOF

# Create the prioritizer module
cat > src/prioritizer.js << 'EOF'
/**
 * Priority classifier module
 * Determines priority levels for different types of changes
 */

// Priority levels for different types of changes
const PRIORITY_LEVELS = {
  P0: "Critical", // Authentication, security-related fields
  P1: "Major",    // New actions, removed features, altered structure
  P2: "Minor"     // Description updates, cosmetic changes
};

// Priority mapping rules
const PRIORITY_RULES = {
  // P0 - Critical changes
  "auth/": "P0",
  "security": "P0",
  "permissions": "P0",
  "authentication": "P0",
  "authorization": "P0",
  
  // P1 - Major changes
  "actions/": "P1",
  "events/": "P1",
  "file-added": "P1",
  "file-removed": "P1",
  "folder-added": "P1",
  "folder-removed": "P1",
  "endpoint": "P1",
  "httpMethod": "P1",
  "inputFields": "P1",
  "outputFields": "P1",
  "trigger": "P1",
  "payload": "P1",
  
  // Default to P2 - Minor changes
  "default": "P2"
};

/**
 * Determine priority level based on change type and path
 * @param {Object} change - The change object
 * @returns {string} - Priority level (P0, P1, P2)
 */
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
    if (change.type === "modified" && (
      (typeof change.oldVal === "string" && change.oldVal.includes(pattern)) ||
      (typeof change.newVal === "string" && change.newVal.includes(pattern))
    )) {
      return priority; 
    }
  }
  
  // Default to P2 - Minor changes
  return PRIORITY_RULES.default;
}

/**
 * Get emoji for change type
 * @param {string} type - Type of change
 * @param {string} priority - Priority level
 * @returns {string} - Emoji representation
 */
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

/**
 * Generate statistics for visualization
 * @param {Array} reports - Array of connector reports
 * @returns {Object} - Statistics object
 */
function generateStats(reports) {
  const stats = {
    priority: { P0: 0, P1: 0, P2: 0 },
    changeTypes: {
      added: 0,
      removed: 0,
      modified: 0,
      'file-added': 0,
      'file-removed': 0,
      'folder-added': 0,
      'folder-removed': 0
    },
    categories: {},
    connectors: {}
  };
  
  for (const { connector, changes } of reports) {
    stats.connectors[connector] = {
      total: changes.length,
      P0: 0,
      P1: 0,
      P2: 0,
    };
    
    for (const change of changes) {
      // Count by priority
      stats.priority[change.priority]++;
      stats.connectors[connector][change.priority]++;
      
      // Count by change type
      stats.changeTypes[change.type]++;
      
      // Count by category
      if (!stats.categories[change.category]) {
        stats.categories[change.category] = {
          total: 0,
          P0: 0,
          P1: 0,
          P2: 0
        };
      }
      stats.categories[change.category].total++;
      stats.categories[change.category][change.priority]++;
    }
  }
  
  return stats;
}

module.exports = { 
  PRIORITY_LEVELS, 
  determinePriority, 
  getChangeEmoji,
  generateStats
};
EOF

# Create file utilities module
cat > src/utils/file-utils.js << 'EOF'
/**
 * File utility functions
 */

const fs = require('fs');
const path = require('path');

/**
 * Load and parse JSON file safely
 * @param {string} filepath - Path to JSON file
 * @returns {Object|null} - Parsed JSON or null if error
 */
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (e) {
    console.error(`❌ Error parsing ${filepath}: ${e.message}`);
    return null;
  }
}

/**
 * Recursively collect all .json files in a given folder
 * @param {string} basePath - Base directory path
 * @returns {Object} - Object mapping filenames to parsed JSON content
 */
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

/**
 * Format JSON value for display (with truncation for large values)
 * @param {any} value - Value to format
 * @param {number} truncateLength - Length at which to truncate
 * @returns {string} - Formatted value
 */
function formatValue(value, truncateLength = 80) {
  const json = JSON.stringify(value);
  if (json.length <= truncateLength) return json;
  return json.substring(0, truncateLength) + "...";
}

module.exports = {
  loadJSON,
  collectJSONFiles,
  formatValue
};
EOF

# Create diff utilities module
cat > src/utils/diff-utils.js << 'EOF'
/**
 * Diff utility functions
 */

/**
 * Word-level diff algorithm for highlighting specific changes
 * @param {string|Object} oldStr - Old string or value
 * @param {string|Object} newStr - New string or value
 * @returns {Object} - Diff result
 */
function diffWords(oldStr, newStr) {
  // Convert objects to strings if needed
  if (typeof oldStr !== 'string') oldStr = JSON.stringify(oldStr, null, 2);
  if (typeof newStr !== 'string') newStr = JSON.stringify(newStr, null, 2);
  
  // Simple character diff implementation (in a real implementation, use a proper diff library)
  const oldWords = oldStr.split(/(\s+|\b)/);
  const newWords = newStr.split(/(\s+|\b)/);
  
  let i = 0, j = 0;
  const result = {
    removed: [],
    added: [],
    unchanged: []
  };
  
  // This is a simplified diff - a production version would use a proper diff algorithm
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      // All remaining words in newWords are added
      while (j < newWords.length) {
        result.added.push(j++);
      }
      break;
    }
    
    if (j >= newWords.length) {
      // All remaining words in oldWords are removed
      while (i < oldWords.length) {
        result.removed.push(i++);
      }
      break;
    }
    
    if (oldWords[i] === newWords[j]) {
      result.unchanged.push(j);
      i++;
      j++;
    } else {
      // Try to find the old word later in the new words
      const oldWordPos = newWords.indexOf(oldWords[i], j);
      // Try to find the new word later in the old words
      const newWordPos = oldWords.indexOf(newWords[j], i);
      
      if (oldWordPos === -1 && newWordPos === -1) {
        // Both words are different
        result.removed.push(i++);
        result.added.push(j++);
      } else if (newWordPos === -1 || (oldWordPos !== -1 && oldWordPos <= newWordPos)) {
        // Word was added
        result.added.push(j++);
      } else {
        // Word was removed
        result.removed.push(i++);
      }
    }
  }
  
  return {
    oldWords,
    newWords,
    diff: result
  };
}

module.exports = {
  diffWords
};
EOF

# Create HTML report generator
cat > src/report-generators/html-report.js << 'EOF'
/**
 * HTML report generator
 */

const fs = require('fs');
const path = require('path');
const { generateStats } = require('../prioritizer');

/**
 * Generate HTML report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write HTML file
 */
async function generateHTMLReport(reports, outputPath) {
  const stats = generateStats(reports);
  
  // Read the HTML template
  const templatePath = path.join(__dirname, '../../templates/html-template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');
  
  // Replace placeholders with data
  template = template.replace('{{REPORT_DATA}}', JSON.stringify(reports));
  template = template.replace('{{STATS_DATA}}', JSON.stringify(stats));
  
  // Write the HTML report
  fs.writeFileSync(outputPath, template, 'utf-8');
}

module.exports = { generateHTMLReport };
EOF

# Create Markdown report generator
cat > src/report-generators/markdown-report.js << 'EOF'
/**
 * Markdown report generator
 */

const fs = require('fs');
const { getChangeEmoji } = require('../prioritizer');
const { formatValue } = require('../utils/file-utils');
const { generateStats } = require('../prioritizer');

/**
 * Generate Markdown report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write Markdown file
 */
async function generateMarkdownReport(reports, outputPath) {
  const stats = generateStats(reports);
  const lines = ["# 📋 Functional Change Report\n"];
  
  // Add priority counts summary
  lines.push(`> **Change Summary:** ${stats.priority.P0} Critical, ${stats.priority.P1} Major, ${stats.priority.P2} Minor changes\n`);
  
  // Collect critical changes for executive summary
  const criticalChanges = [];
  for (const { connector, changes } of reports) {
    for (const change of changes) {
      if (change.priority === "P0" || change.priority === "P1") {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  // Create executive summary if there are any critical changes
  if (criticalChanges.length > 0) {
    lines.push(`## 🚨 Executive Summary\n`);
    
    // Group by connector
    const criticalByConnector = {};
    for (const change of criticalChanges) {
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
        
        let description;
        if (change.type === "file-added") {
          description = `Added file: \`${change.file}\``;
        } else if (change.type === "file-removed") {
          description = `Removed file: \`${change.file}\``;
        } else if (change.type === "folder-added") {
          description = `Added folder: \`${change.folder}/\``;
        } else if (change.type === "folder-removed") {
          description = `Removed folder: \`${change.folder}/\``;
        } else if (change.type === "added") {
          description = `Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``;
        } else if (change.type === "removed") {
          description = `Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`;
        } else if (change.type === "modified") {
          description = `Changed \`${change.path}\``;
        }
        
        lines.push(`- ${priority} ${emoji} ${description}`);
      }
      
      lines.push('');
    }
  }
  
  // Detailed changes by connector
  for (const { connector, changes } of reports) {
    if (changes.length === 0) continue;
    
    lines.push(`## 🔌 Connector: \`${connector}\`\n`);

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
      if (change.type === "modified" && change.path && change.path.includes("auth"))
        summary.push(`🔐 Auth change`);
      if (change.type === "modified" && change.path && change.path.includes("outputFields"))
        summary.push(`📦 Output structure changed`);
    }

    lines.push(`### 🧾 Summary of Changes`);
    for (const item of [...new Set(summary)]) {
      lines.push(`- ${item}`);
    }
    lines.push('');

    // Group changes by category
    for (const [category, catChanges] of Object.entries(categoryMap)) {
      const catTitle = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`### 📂 ${catTitle} Changes`);

      for (const change of catChanges) {
        const emoji = getChangeEmoji(change.type, change.priority);
        
        if (change.type === "file-added") {
          lines.push(`${emoji} New file: \`${change.file}\``);
        } else if (change.type === "file-removed") {
          lines.push(`${emoji} Removed file: \`${change.file}\``);
        } else if (change.type === "folder-added") {
          lines.push(`${emoji} New folder added: \`${change.folder}/\``);
        } else if (change.type === "folder-removed") {
          lines.push(`${emoji} Folder removed: \`${change.folder}/\``);
        } else if (change.type === "added") {
          lines.push(`${emoji} Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``);
        } else if (change.type === "removed") {
          lines.push(`${emoji} Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`);
        } else if (change.type === "modified") {
          lines.push(`${emoji} Changed \`${change.path}\`: \`${formatValue(change.oldVal)}\` → \`${formatValue(change.newVal)}\``);
        }
      }
      
      lines.push('');
    }
  }

  fs.writeFileSync(outputPath, lines.join("\n"), 'utf-8');
}

module.exports = { generateMarkdownReport };
EOF

# Create JSON report generator
cat > src/report-generators/json-report.js << 'EOF'
/**
 * JSON data report generator
 */

const fs = require('fs');

/**
 * Generate JSON report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write JSON file
 */
async function generateJSONReport(reports, outputPath) {
  // Create a formatted JSON string
  const jsonContent = JSON.stringify(reports, null, 2);
  
  // Write the JSON file
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
}

module.exports = { generateJSONReport };
EOF

# Create HTML template
cat > templates/html-template.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Advanced Functional Change Report</title>
  <style>
    :root {
      --color-bg: #ffffff;
      --color-text: #333333;
      --color-primary: #0366d6;
      --color-secondary: #6c757d;
      --color-success: #28a745;
      --color-danger: #dc3545;
      --color-warning: #ffc107;
      --color-info: #17a2b8;
      --color-light: #f8f9fa;
      --color-dark: #343a40;
      --color-p0: #dc3545;
      --color-p1: #ffc107;
      --color-p2: #28a745;
      --color-border: #e1e4e8;
      --color-hover: #f6f8fa;
      --color-code-bg: #f6f8fa;
      --font-mono: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      --shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
    }
    
    [data-theme="dark"] {
      --color-bg: #0d1117;
      --color-text: #c9d1d9;
      --color-primary: #58a6ff;
      --color-secondary: #8b949e;
      --color-success: #3fb950;
      --color-danger: #f85149;
      --color-warning: #d29922;
      --color-info: #58a6ff;
      --color-light: #161b22;
      --color-dark: #c9d1d9;
      --color-p0: #f85149;
      --color-p1: #d29922;
      --color-p2: #3fb950;
      --color-border: #30363d;
      --color-hover: #161b22;
      --color-code-bg: #161b22;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text);
      background-color: var(--color-bg);
      margin: 0;
      padding: 20px;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    /* Layout */
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 10px;
    }
    
    .controls {
      position: sticky;
      top: 0;
      background-color: var(--color-bg);
      z-index: 100;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 20px;
    }
    
    .filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    /* Typography */
    h1 {
      font-size: 24px;
      margin-top: 0;
    }
    
    h2 {
      font-size: 20px;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--color-border);
    }
    
    h3 {
      font-size: 16px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    
    h4 {
      font-size: 14px;
      margin-top: 15px;
      margin-bottom: 10px;
    }
    
    a {
      color: var(--color-primary);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    code {
      font-family: var(--font-mono);
      font-size: 85%;
      padding: 0.2em 0.4em;
      background-color: var(--color-code-bg);
      border-radius: 3px;
    }
    
    pre {
      font-family: var(--font-mono);
      font-size: 85%;
      line-height: 1.45;
      background-color: var(--color-code-bg);
      border-radius: 3px;
      overflow: auto;
      padding: 16px;
      margin: 0 0 16px 0;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    
    table th, table td {
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      text-align: left;
    }
    
    table th {
      background-color: var(--color-code-bg);
      font-weight: 600;
    }
    
    table tr:nth-child(even) {
      background-color: var(--color-hover);
    }
    
    /* Details/Summary Styles */
    details {
      margin-bottom: 16px;
    }
    
    details > summary {
      cursor: pointer;
      padding: 8px;
      background-color: var(--color-code-bg);
      border-radius: 3px;
      border: 1px solid var(--color-border);
      font-weight: 600;
    }
    
    details[open] > summary {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom: none;
      margin-bottom: 0;
    }
    
    details > div {
      border: 1px solid var(--color-border);
      border-top: none;
      padding: 8px 16px;
      border-bottom-left-radius: 3px;
      border-bottom-right-radius: 3px;
    }
    
    /* Badge Styles */
    .badge {
      display: inline-block;
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      margin-left: 5px;
    }
    
    .badge-p0 {
      background-color: var(--color-p0);
      color: white;
    }
    
    .badge-p1 {
      background-color: var(--color-p1);
      color: black;
    }
    
    .badge-p2 {
      background-color: var(--color-p2);
      color: white;
    }
    
    /* Change Type Indicators */
    .change-added {
      background-color: rgba(40, 167, 69, 0.2);
    }
    
    .change-removed {
      background-color: rgba(220, 53, 69, 0.2);
    }
    
    .change-modified {
      background-color: rgba(255, 193, 7, 0.2);
    }
    
    /* Progress Bars */
    .progress-container {
      height: 20px;
      background-color: var(--color-code-bg);
      border-radius: 3px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      float: left;
      text-align: center;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
    }
    
    /* Buttons */
    button, .btn {
      display: inline-block;
      font-weight: 400;
      text-align: center;
      vertical-align: middle;
      cursor: pointer;
      padding: 6px 12px;
      font-size: 14px;
      line-height: 1.5;
      border-radius: 3px;
      color: var(--color-text);
      background-color: var(--color-light);
      border: 1px solid var(--color-border);
      transition: all 0.2s ease-in-out;
    }
    
    button:hover, .btn:hover {
      background-color: var(--color-hover);
    }
    
    button:active, .btn:active {
      transform: translateY(1px);
    }
    
    button:focus, .btn:focus {
      outline: none;
      box-shadow: 0 0 0 0.2rem rgba(3, 102, 214, 0.25);
    }
    
    .btn-sm {
      padding: 4px 8px;
      font-size: 12px;
    }
    
    .btn-primary {
      color: white;
      background-color: var(--color-primary);
      border-color: var(--color-primary);
    }
    
    /* Checkbox filters */
    .filter-checkbox {
      display: none;
    }
    
    .filter-label {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      border: 1px solid var(--color-border);
      cursor: pointer;
      margin-right: 5px;
      user-select: none;
    }
    
    .filter-checkbox:checked + .filter-label {
      background-color: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    
    /* Theme Switch */
    .theme-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }
    
    .theme-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .theme-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--color-secondary);
      transition: .4s;
      border-radius: 24px;
    }
    
    .theme-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .theme-slider {
      background-color: var(--color-primary);
    }
    
    input:checked + .theme-slider:before {
      transform: translateX(26px);
    }
    
    /* Back to top button */
    .back-to-top {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      background-color: var(--color-primary);
      color: white;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.3s;
      box-shadow: var(--shadow);
    }
    
    .back-to-top.visible {
      opacity: 1;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .stats-card {
      border: 1px solid var(--color-border);
      border-radius: 3px;
      padding: 15px;
      box-shadow: var(--shadow);
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .filter-group {
        flex-direction: column;
      }
    }
    
    /* Print Styles */
    @media print {
      .controls, .back-to-top {
        display: none !important;
      }
      
      body {
        padding: 0;
      }
      
      .container {
        max-width: none;
      }
      
      details {
        break-inside: avoid;
      }
      
      details[open] > summary {
        margin-bottom: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Advanced Functional Change Report</h1>
      <div>
        <span>Theme:</span>
        <label class="theme-switch">
          <input type="checkbox" id="theme-toggle">
          <span class="theme-slider"></span>
        </label>
      </div>
    </div>
    
    <div class="controls" id="controls">
      <div class="search-container">
        <input type="text" id="search-input" class="search-input" placeholder="Search for changes..." autocomplete="off">
        <div id="search-results" class="search-results"></div>
      </div>
      
      <div class="filter-group">
        <strong>Priority:</strong>
        <input type="checkbox" id="filter-p0" class="filter-checkbox" checked>
        <label for="filter-p0" class="filter-label badge-p0">Critical</label>
        
        <input type="checkbox" id="filter-p1" class="filter-checkbox" checked>
        <label for="filter-p1" class="filter-label badge-p1">Major</label>
        
        <input type="checkbox" id="filter-p2" class="filter-checkbox" checked>
        <label for="filter-p2" class="filter-label badge-p2">Minor</label>
      </div>
      
      <div class="filter-group">
        <strong>Type:</strong>
        <input type="checkbox" id="filter-added" class="filter-checkbox" checked>
        <label for="filter-added" class="filter-label">Added</label>
        
        <input type="checkbox" id="filter-removed" class="filter-checkbox" checked>
        <label for="filter-removed" class="filter-label">Removed</label>
        
        <input type="checkbox" id="filter-modified" class="filter-checkbox" checked>
        <label for="filter-modified" class="filter-label">Modified</label>
      </div>
      
      <div class="filter-group">
        <strong>Category:</strong>
        <div id="category-filters">
          <!-- Dynamically generated based on available categories -->
        </div>
      </div>
      
      <div class="export-group">
        <button id="btn-export-pdf" class="btn btn-sm">📄 Export PDF</button>
        <button id="btn-export-html" class="btn btn-sm">💾 Export HTML</button>
        <button id="btn-export-md" class="btn btn-sm">📝 Export Markdown</button>
        <button id="btn-export-json" class="btn btn-sm">{ } Export JSON</button>
        <button id="btn-reset-filters" class="btn btn-sm btn-primary">🔄 Reset Filters</button>
      </div>
    </div>
    
    <div id="stats-summary">
      <!-- Statistics summary will be generated here -->
    </div>
    
    <div id="table-of-contents">
      <!-- Table of contents will be generated here -->
    </div>
    
    <div id="executive-summary">
      <!-- Executive summary will be generated here -->
    </div>
    
    <div id="report-content">
      <!-- Report content will be generated here -->
    </div>
  </div>
  
  <div class="back-to-top" id="back-to-top">↑</div>
  
  <script src="../templates/scripts/filters.js"></script>
  <script src="../templates/scripts/visualizations.js"></script>
  <script src="../templates/scripts/interactivity.js"></script>
  <script>
    // Store the report data as a JavaScript object
    const reportData = {{REPORT_DATA}};
    const statsData = {{STATS_DATA}};
  </script>
</body>
</html>
EOF

# Create JavaScript files for the template
mkdir -p templates/scripts

# Create filters.js
cat > templates/scripts/filters.js << 'EOF'
/**
 * Filtering functionality
 */

// Track current filter state
const filterState = {
  priority: {
    P0: true,
    P1: true,
    P2: true
  },
  type: {
    added: true,
    removed: true,
    modified: true,
    'file-added': true,
    'file-removed': true,
    'folder-added': true,
    'folder-removed': true
  },
  category: {},
  search: ''
};

// Apply filters to the report
function applyFilters() {
  const searchResults = document.getElementById('search-results');
  let matchCount = 0;
  let totalCount = 0;
  
  // Process each change item
  const changeItems = document.querySelectorAll('.change-item');
  changeItems.forEach(item => {
    const priority = item.dataset.priority;
    const type = item.dataset.type;
    const category = item.dataset.category;
    
    totalCount++;
    
    // Check if item matches all filters
    const matchesPriority = filterState.priority[priority];
    const matchesType = filterState.type[type];
    const matchesCategory = filterState.category[category];
    
    // Check if item matches search
    const matchesSearch = filterState.search === '' || 
      item.textContent.toLowerCase().includes(filterState.search);
    
    const isVisible = matchesPriority && matchesType && matchesCategory && matchesSearch;
    
    // Show/hide item
    item.style.display = isVisible ? 'block' : 'none';
    
    if (isVisible) matchCount++;
  });
  
  // Update search results
  if (filterState.search !== '') {
    searchResults.textContent = `Found ${matchCount} matches`;
    searchResults.style.display = 'block';
  } else {
    searchResults.style.display = 'none';
  }
  
  // Update executive summary items
  const summaryItems = document.querySelectorAll('#executive-summary li');
  summaryItems.forEach(item => {
    const priority = item.dataset.priority;
    const type = item.dataset.type;
    const category = item.dataset.category;
    
    const matchesPriority = filterState.priority[priority];
    const matchesType = filterState.type[type];
    const matchesCategory = filterState.category[category];
    const matchesSearch = filterState.search === '' || 
      item.textContent.toLowerCase().includes(filterState.search);
    
    item.style.display = (matchesPriority && matchesType && matchesCategory && matchesSearch) ? 'list-item' : 'none';
  });
}

// Reset all filters
function resetFilters() {
  // Reset priority filters
  filterState.priority.P0 = true;
  filterState.priority.P1 = true;
  filterState.priority.P2 = true;
  
  document.getElementById('filter-p0').checked = true;
  document.getElementById('filter-p1').checked = true;
  document.getElementById('filter-p2').checked = true;
  
  // Reset type filters
  filterState.type.added = true;
  filterState.type['file-added'] = true;
  filterState.type['folder-added'] = true;
  filterState.type.removed = true;
  filterState.type['file-removed'] = true;
  filterState.type['folder-removed'] = true;
  filterState.type.modified = true;
  
  document.getElementById('filter-added').checked = true;
  document.getElementById('filter-removed').checked = true;
  document.getElementById('filter-modified').checked = true;
  
  // Reset category filters
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    checkbox.checked = true;
    filterState.category[checkbox.dataset.category] = true;
  });
  
  // Reset search
  document.getElementById('search-input').value = '';
  filterState.search = '';
  
  // Apply filters
  applyFilters();
  updateUrlParams();
}

// Update URL parameters to reflect current filter state
function updateUrlParams() {
  const params = new URLSearchParams();
  
  // Add priority params
  if (!filterState.priority.P0) params.append('p0', 'false');
  if (!filterState.priority.P1) params.append('p1', 'false');
  if (!filterState.priority.P2) params.append('p2', 'false');
  
  // Add type params
  if (!filterState.type.added) params.append('added', 'false');
  if (!filterState.type.removed) params.append('removed', 'false');
  if (!filterState.type.modified) params.append('modified', 'false');
  
  // Add category params
  for (const [category, enabled] of Object.entries(filterState.category)) {
    if (!enabled) params.append(`cat_${category}`, 'false');
  }
  
  // Add search param
  if (filterState.search) params.append('search', filterState.search);
  
  // Update URL without reloading page
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', newUrl);
}

// Apply URL parameters
function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  
  // Apply priority params
  if (params.get('p0') === 'false') {
    filterState.priority.P0 = false;
    document.getElementById('filter-p0').checked = false;
  }
  
  if (params.get('p1') === 'false') {
    filterState.priority.P1 = false;
    document.getElementById('filter-p1').checked = false;
  }
  
  if (params.get('p2') === 'false') {
    filterState.priority.P2 = false;
    document.getElementById('filter-p2').checked = false;
  }
  
  // Apply type params
  if (params.get('added') === 'false') {
    filterState.type.added = false;
    filterState.type['file-added'] = false;
    filterState.type['folder-added'] = false;
    document.getElementById('filter-added').checked = false;
  }
  
  if (params.get('removed') === 'false') {
    filterState.type.removed = false;
    filterState.type['file-removed'] = false;
    filterState.type['folder-removed'] = false;
    document.getElementById('filter-removed').checked = false;
  }
  
  if (params.get('modified') === 'false') {
    filterState.type.modified = false;
    document.getElementById('filter-modified').checked = false;
  }
  
  // Apply category params
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    const category = checkbox.dataset.category;
    if (params.get(`cat_${category}`) === 'false') {
      filterState.category[category] = false;
      checkbox.checked = false;
    }
  });
  
  // Apply search param
  const searchValue = params.get('search');
  if (searchValue) {
    filterState.search = searchValue;
    document.getElementById('search-input').value = searchValue;
  }
  
  // Apply filters
  applyFilters();
}
EOF

# Create visualizations.js
cat > templates/scripts/visualizations.js << 'EOF'
/**
 * Visualization and stats functionality
 */

// Generate statistics summary with visualizations
function generateStatsSummary() {
  const statsElement = document.getElementById('stats-summary');
  
  statsElement.innerHTML = `
    <h2>📊 Change Statistics</h2>
    <details open>
      <summary><strong>Statistics Overview</strong></summary>
      <div class="stats-grid">
        <div class="stats-card">
          <h3>Changes by Priority</h3>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P0, getTotalChanges())}%; background-color: var(--color-p0);" title="Critical: ${statsData.priority.P0}">
              ${statsData.priority.P0}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P1, getTotalChanges())}%; background-color: var(--color-p1);" title="Major: ${statsData.priority.P1}">
              ${statsData.priority.P1}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P2, getTotalChanges())}%; background-color: var(--color-p2);" title="Minor: ${statsData.priority.P2}">
              ${statsData.priority.P2}
            </div>
          </div>
          <p>
            <span class="badge badge-p0">${statsData.priority.P0} Critical</span>
            <span class="badge badge-p1">${statsData.priority.P1} Major</span>
            <span class="badge badge-p2">${statsData.priority.P2} Minor</span>
          </p>
        </div>
        
        <div class="stats-card">
          <h3>Changes by Type</h3>
          <ul>
            <li>🆕 Added: ${statsData.changeTypes.added + statsData.changeTypes['file-added'] + statsData.changeTypes['folder-added']}</li>
            <li>❌ Removed: ${statsData.changeTypes.removed + statsData.changeTypes['file-removed'] + statsData.changeTypes['folder-removed']}</li>
            <li>✏️ Modified: ${statsData.changeTypes.modified}</li>
          </ul>
        </div>
        
        <div class="stats-card">
          <h3>Top Categories</h3>
          <ul>
            ${Object.entries(statsData.categories)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 3)
              .map(([category, data]) => `
                <li>${category}: ${data.total} changes (${data.P0} critical)</li>
              `).join('')}
          </ul>
        </div>
      </div>
    </details>
  `;
}

// Get total number of changes
function getTotalChanges() {
  return statsData.priority.P0 + statsData.priority.P1 + statsData.priority.P2;
}

// Calculate percentage
function getPercentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Generate table of contents
function generateTableOfContents() {
  const tocElement = document.getElementById('table-of-contents');
  
  let tocHTML = `
    <h2>📖 Table of Contents</h2>
    <details open>
      <summary><strong>Navigation</strong></summary>
      <ul>
  `;
  
  // Add executive summary link
  tocHTML += `<li><a href="#executive-summary">Executive Summary</a></li>`;
  
  // Add connector links
  for (const { connector, changes } of reportData) {
    if (changes.length === 0) continue;
    
    const p0Count = changes.filter(c => c.priority === 'P0').length;
    const p1Count = changes.filter(c => c.priority === 'P1').length;
    const p2Count = changes.filter(c => c.priority === 'P2').length;
    
    const badges = [];
    if (p0Count > 0) badges.push(`<span class="badge badge-p0">${p0Count}</span>`);
    if (p1Count > 0) badges.push(`<span class="badge badge-p1">${p1Count}</span>`);
    if (p2Count > 0) badges.push(`<span class="badge badge-p2">${p2Count}</span>`);
    
    tocHTML += `<li><a href="#connector-${connector}">${connector}</a> ${badges.join(' ')}</li>`;
  }
  
  tocHTML += `
      </ul>
    </details>
  `;
  
  tocElement.innerHTML = tocHTML;
}

// Generate executive summary
function generateExecutiveSummary() {
  const executiveSummaryElement = document.getElementById('executive-summary');
  const criticalChanges = [];
  
  // Collect critical and major changes
  for (const { connector, changes } of reportData) {
    for (const change of changes) {
      if (change.priority === 'P0' || change.priority === 'P1') {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  // Sort by priority, then connector
  criticalChanges.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'P0' ? -1 : 1;
    }
    return a.connector.localeCompare(b.connector);
  });
  
  if (criticalChanges.length === 0) {
    executiveSummaryElement.innerHTML = `
      <h2 id="executive-summary">🚨 Executive Summary</h2>
      <p>No critical or major changes detected.</p>
    `;
    return;
  }
  
  // Group by connector
  const criticalByConnector = {};
  for (const change of criticalChanges) {
    if (!criticalByConnector[change.connector]) {
      criticalByConnector[change.connector] = [];
    }
    criticalByConnector[change.connector].push(change);
  }
  
  let summaryHTML = `
    <h2 id="executive-summary">🚨 Executive Summary</h2>
    <details open>
      <summary><strong>Critical and Major Changes (${criticalChanges.length})</strong></summary>
  `;
  
  // List critical changes by connector
  for (const [connector, changes] of Object.entries(criticalByConnector)) {
    summaryHTML += `<h3>${connector}</h3><ul>`;
    
    for (const change of changes) {
      const emoji = getChangeEmoji(change.type, change.priority);
      const priority = change.priority === 'P0' ? '🔴' : '🟠';
      
      // Create anchor link
      const anchor = `${connector}-${change.category}-${change.type}-${change.path || change.file || change.folder}`.replace(/[^\w-]/g, '-');
      
      let description;
      if (change.type === 'file-added') {
        description = `Added file: <code>${change.file}</code>`;
      } else if (change.type === 'file-removed') {
        description = `Removed file: <code>${change.file}</code>`;
      } else if (change.type === 'folder-added') {
        description = `Added folder: <code>${change.folder}/</code>`;
      } else if (change.type === 'folder-removed') {
        description = `Removed folder: <code>${change.folder}/</code>`;
      } else if (change.type === 'added') {
        description = `Added <code>${change.path}</code>`;
      } else if (change.type === 'removed') {
        description = `Removed <code>${change.path}</code>`;
      } else if (change.type === 'modified') {
        description = `Changed <code>${change.path}</code>`;
      }
      
      summaryHTML += `<li data-priority="${change.priority}" data-type="${change.type}" data-category="${change.category}">${priority} ${emoji} ${description} <a href="#${anchor}">(details)</a></li>`;
    }
    
    summaryHTML += '</ul>';
  }
  
  summaryHTML += '</details>';
  executiveSummaryElement.innerHTML = summaryHTML;
}

// Get emoji for change type
function getChangeEmoji(type, priority) {
  switch (type) {
    case 'file-added':
    case 'folder-added':
    case 'added':
      return '➕';
    case 'file-removed':
    case 'folder-removed':
    case 'removed':
      return '❌';
    case 'modified':
      return '✏️';
    default:
      // Use priority-based emoji for other cases
      if (priority === 'P0') return '🚨';
      if (priority === 'P1') return '⚠️';
      return 'ℹ️';
  }
}
EOF

# Create interactivity.js
cat > templates/scripts/interactivity.js << 'EOF'
/**
 * UI interactions and event handlers
 */

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Setup theme toggle
  initTheme();
  
  // Generate category filters
  generateCategoryFilters();
  
  // Generate statistics summary
  generateStatsSummary();
  
  // Generate table of contents
  generateTableOfContents();
  
  // Generate executive summary
  generateExecutiveSummary();
  
  // Generate full report content
  generateReportContent();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup back to top button
  setupBackToTop();
  
  // Apply URL parameters if any
  applyUrlParams();
});

// Initialize theme based on preferences
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('theme');
  
  if (storedTheme === 'dark' || (!storedTheme && prefersDarkMode)) {
    document.body.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
  }
  
  themeToggle.addEventListener('change', function() {
    if (this.checked) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  });
}

// Generate category filters based on available categories
function generateCategoryFilters() {
  const categoryFilters = document.getElementById('category-filters');
  const categories = {};
  
  //#!/bin/bash

# Script to set up the directory structure and files for the enhanced change detection project

# Create the directory structure
mkdir -p src/report-generators src/utils templates/scripts

# Create the main entry point
cat > src/index.js << 'EOF'
/**
 * Advanced JSON Functional Change Detection
 * Main entry point
 */

const path = require('path');
const { compareConnectors } = require('./comparator');
const { generateHTMLReport } = require('./report-generators/html-report');
const { generateMarkdownReport } = require('./report-generators/markdown-report');
const { generateJSONReport } = require('./report-generators/json-report');

// Paths to connector directories
const prevPath = path.join(__dirname, '..', 'connectors', 'previous');
const currPath = path.join(__dirname, '..', 'connectors', 'current');

async function run() {
  console.log("🔍 Starting functional change detection...");
  
  // Compare connectors
  console.log(`📂 Analyzing connectors in ${prevPath} and ${currPath}...`);
  const comparisonResult = await compareConnectors(prevPath, currPath);
  
  // Generate reports
  console.log("📝 Generating reports...");
  
  // Generate HTML report
  await generateHTMLReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.html'));
  console.log("✅ HTML report generated: functional-change-report.html");
  
  // Generate Markdown report
  await generateMarkdownReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.md'));
  console.log("✅ Markdown report generated: functional-change-report.md");
  
  // Generate JSON report
  await generateJSONReport(comparisonResult, path.join(__dirname, '..', 'functional-change-data.json'));
  console.log("✅ JSON data generated: functional-change-data.json");
  
  console.log("✨ Process complete!");
}

// Run the program
run().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});
EOF

# Create the comparator module
cat > src/comparator.js << 'EOF'
/**
 * JSON comparison module
 * Compares JSON structures between two connector versions
 */

const fs = require('fs');
const path = require('path');
const { loadJSON, collectJSONFiles } = require('./utils/file-utils');
const { determinePriority } = require('./prioritizer');

// List of known subfolders to inspect in each connector
const SUBFOLDERS = ["actions", "auth", "events", "meta", "metadata"];

/**
 * Deeply compares two objects and returns the differences
 * @param {Object} oldObj - The old object
 * @param {Object} newObj - The new object
 * @param {string} pathPrefix - Prefix for the property path
 * @returns {Array} - Array of change objects
 */
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
    else if (typeof oldVal === "object" && oldVal !== null && 
             typeof newVal === "object" && newVal !== null &&
             !Array.isArray(oldVal) && !Array.isArray(newVal)) {
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

/**
 * Compares connectors between previous and current versions
 * @param {string} prevPath - Path to previous connector directory
 * @param {string} currPath - Path to current connector directory
 * @returns {Array} - Comparison results for each connector
 */
async function compareConnectors(prevPath, currPath) {
  // Validate paths
  if (!fs.existsSync(prevPath)) {
    throw new Error(`Previous directory not found: ${prevPath}`);
  }
  
  if (!fs.existsSync(currPath)) {
    throw new Error(`Current directory not found: ${currPath}`);
  }

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
            priority: determinePriority({ 
              type: "file-added", 
              file: `${subfolder}/${file}`, 
              category: subfolder 
            })
          });
        } else if (!newJson) {
          report.changes.push({
            type: "file-removed",
            file: `${subfolder}/${file}`,
            category: subfolder,
            priority: determinePriority({ 
              type: "file-removed", 
              file: `${subfolder}/${file}`, 
              category: subfolder 
            })
          });
        } else {
          const diffs = diffObjects(
            oldJson,
            newJson,
            `${subfolder}/${file.replace(".json", "")}`
          );
          
          // Add category and priority to each diff
          const enhancedDiffs = diffs.map(diff => ({
            ...diff,
            category: subfolder,
            priority: determinePriority({
              ...diff,
              category: subfolder
            })
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
            category: subfolder 
          })
        });
      } else if (fs.existsSync(prevSub) && !fs.existsSync(currSub)) {
        report.changes.push({
          type: "folder-removed",
          folder: subfolder,
          category: subfolder,
          priority: determinePriority({ 
            type: "folder-removed", 
            folder: subfolder, 
            category: subfolder 
          })
        });
      }
    }

    results.push(report);
  }

  return results;
}

module.exports = { compareConnectors, diffObjects };
EOF

# Create the prioritizer module
cat > src/prioritizer.js << 'EOF'
/**
 * Priority classifier module
 * Determines priority levels for different types of changes
 */

// Priority levels for different types of changes
const PRIORITY_LEVELS = {
  P0: "Critical", // Authentication, security-related fields
  P1: "Major",    // New actions, removed features, altered structure
  P2: "Minor"     // Description updates, cosmetic changes
};

// Priority mapping rules
const PRIORITY_RULES = {
  // P0 - Critical changes
  "auth/": "P0",
  "security": "P0",
  "permissions": "P0",
  "authentication": "P0",
  "authorization": "P0",
  
  // P1 - Major changes
  "actions/": "P1",
  "events/": "P1",
  "file-added": "P1",
  "file-removed": "P1",
  "folder-added": "P1",
  "folder-removed": "P1",
  "endpoint": "P1",
  "httpMethod": "P1",
  "inputFields": "P1",
  "outputFields": "P1",
  "trigger": "P1",
  "payload": "P1",
  
  // Default to P2 - Minor changes
  "default": "P2"
};

/**
 * Determine priority level based on change type and path
 * @param {Object} change - The change object
 * @returns {string} - Priority level (P0, P1, P2)
 */
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
    if (change.type === "modified" && (
      (typeof change.oldVal === "string" && change.oldVal.includes(pattern)) ||
      (typeof change.newVal === "string" && change.newVal.includes(pattern))
    )) {
      return priority; 
    }
  }
  
  // Default to P2 - Minor changes
  return PRIORITY_RULES.default;
}

/**
 * Get emoji for change type
 * @param {string} type - Type of change
 * @param {string} priority - Priority level
 * @returns {string} - Emoji representation
 */
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

/**
 * Generate statistics for visualization
 * @param {Array} reports - Array of connector reports
 * @returns {Object} - Statistics object
 */
function generateStats(reports) {
  const stats = {
    priority: { P0: 0, P1: 0, P2: 0 },
    changeTypes: {
      added: 0,
      removed: 0,
      modified: 0,
      'file-added': 0,
      'file-removed': 0,
      'folder-added': 0,
      'folder-removed': 0
    },
    categories: {},
    connectors: {}
  };
  
  for (const { connector, changes } of reports) {
    stats.connectors[connector] = {
      total: changes.length,
      P0: 0,
      P1: 0,
      P2: 0,
    };
    
    for (const change of changes) {
      // Count by priority
      stats.priority[change.priority]++;
      stats.connectors[connector][change.priority]++;
      
      // Count by change type
      stats.changeTypes[change.type]++;
      
      // Count by category
      if (!stats.categories[change.category]) {
        stats.categories[change.category] = {
          total: 0,
          P0: 0,
          P1: 0,
          P2: 0
        };
      }
      stats.categories[change.category].total++;
      stats.categories[change.category][change.priority]++;
    }
  }
  
  return stats;
}

module.exports = { 
  PRIORITY_LEVELS, 
  determinePriority, 
  getChangeEmoji,
  generateStats
};
EOF

# Create file utilities module
cat > src/utils/file-utils.js << 'EOF'
/**
 * File utility functions
 */

const fs = require('fs');
const path = require('path');

/**
 * Load and parse JSON file safely
 * @param {string} filepath - Path to JSON file
 * @returns {Object|null} - Parsed JSON or null if error
 */
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (e) {
    console.error(`❌ Error parsing ${filepath}: ${e.message}`);
    return null;
  }
}

/**
 * Recursively collect all .json files in a given folder
 * @param {string} basePath - Base directory path
 * @returns {Object} - Object mapping filenames to parsed JSON content
 */
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

/**
 * Format JSON value for display (with truncation for large values)
 * @param {any} value - Value to format
 * @param {number} truncateLength - Length at which to truncate
 * @returns {string} - Formatted value
 */
function formatValue(value, truncateLength = 80) {
  const json = JSON.stringify(value);
  if (json.length <= truncateLength) return json;
  return json.substring(0, truncateLength) + "...";
}

module.exports = {
  loadJSON,
  collectJSONFiles,
  formatValue
};
EOF

# Create diff utilities module
cat > src/utils/diff-utils.js << 'EOF'
/**
 * Diff utility functions
 */

/**
 * Word-level diff algorithm for highlighting specific changes
 * @param {string|Object} oldStr - Old string or value
 * @param {string|Object} newStr - New string or value
 * @returns {Object} - Diff result
 */
function diffWords(oldStr, newStr) {
  // Convert objects to strings if needed
  if (typeof oldStr !== 'string') oldStr = JSON.stringify(oldStr, null, 2);
  if (typeof newStr !== 'string') newStr = JSON.stringify(newStr, null, 2);
  
  // Simple character diff implementation (in a real implementation, use a proper diff library)
  const oldWords = oldStr.split(/(\s+|\b)/);
  const newWords = newStr.split(/(\s+|\b)/);
  
  let i = 0, j = 0;
  const result = {
    removed: [],
    added: [],
    unchanged: []
  };
  
  // This is a simplified diff - a production version would use a proper diff algorithm
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      // All remaining words in newWords are added
      while (j < newWords.length) {
        result.added.push(j++);
      }
      break;
    }
    
    if (j >= newWords.length) {
      // All remaining words in oldWords are removed
      while (i < oldWords.length) {
        result.removed.push(i++);
      }
      break;
    }
    
    if (oldWords[i] === newWords[j]) {
      result.unchanged.push(j);
      i++;
      j++;
    } else {
      // Try to find the old word later in the new words
      const oldWordPos = newWords.indexOf(oldWords[i], j);
      // Try to find the new word later in the old words
      const newWordPos = oldWords.indexOf(newWords[j], i);
      
      if (oldWordPos === -1 && newWordPos === -1) {
        // Both words are different
        result.removed.push(i++);
        result.added.push(j++);
      } else if (newWordPos === -1 || (oldWordPos !== -1 && oldWordPos <= newWordPos)) {
        // Word was added
        result.added.push(j++);
      } else {
        // Word was removed
        result.removed.push(i++);
      }
    }
  }
  
  return {
    oldWords,
    newWords,
    diff: result
  };
}

module.exports = {
  diffWords
};
EOF

# Create HTML report generator
cat > src/report-generators/html-report.js << 'EOF'
/**
 * HTML report generator
 */

const fs = require('fs');
const path = require('path');
const { generateStats } = require('../prioritizer');

/**
 * Generate HTML report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write HTML file
 */
async function generateHTMLReport(reports, outputPath) {
  const stats = generateStats(reports);
  
  // Read the HTML template
  const templatePath = path.join(__dirname, '../../templates/html-template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');
  
  // Replace placeholders with data
  template = template.replace('{{REPORT_DATA}}', JSON.stringify(reports));
  template = template.replace('{{STATS_DATA}}', JSON.stringify(stats));
  
  // Write the HTML report
  fs.writeFileSync(outputPath, template, 'utf-8');
}

module.exports = { generateHTMLReport };
EOF

# Create Markdown report generator
cat > src/report-generators/markdown-report.js << 'EOF'
/**
 * Markdown report generator
 */

const fs = require('fs');
const { getChangeEmoji } = require('../prioritizer');
const { formatValue } = require('../utils/file-utils');
const { generateStats } = require('../prioritizer');

/**
 * Generate Markdown report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write Markdown file
 */
async function generateMarkdownReport(reports, outputPath) {
  const stats = generateStats(reports);
  const lines = ["# 📋 Functional Change Report\n"];
  
  // Add priority counts summary
  lines.push(`> **Change Summary:** ${stats.priority.P0} Critical, ${stats.priority.P1} Major, ${stats.priority.P2} Minor changes\n`);
  
  // Collect critical changes for executive summary
  const criticalChanges = [];
  for (const { connector, changes } of reports) {
    for (const change of changes) {
      if (change.priority === "P0" || change.priority === "P1") {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  // Create executive summary if there are any critical changes
  if (criticalChanges.length > 0) {
    lines.push(`## 🚨 Executive Summary\n`);
    
    // Group by connector
    const criticalByConnector = {};
    for (const change of criticalChanges) {
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
        
        let description;
        if (change.type === "file-added") {
          description = `Added file: \`${change.file}\``;
        } else if (change.type === "file-removed") {
          description = `Removed file: \`${change.file}\``;
        } else if (change.type === "folder-added") {
          description = `Added folder: \`${change.folder}/\``;
        } else if (change.type === "folder-removed") {
          description = `Removed folder: \`${change.folder}/\``;
        } else if (change.type === "added") {
          description = `Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``;
        } else if (change.type === "removed") {
          description = `Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`;
        } else if (change.type === "modified") {
          description = `Changed \`${change.path}\``;
        }
        
        lines.push(`- ${priority} ${emoji} ${description}`);
      }
      
      lines.push('');
    }
  }
  
  // Detailed changes by connector
  for (const { connector, changes } of reports) {
    if (changes.length === 0) continue;
    
    lines.push(`## 🔌 Connector: \`${connector}\`\n`);

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
      if (change.type === "modified" && change.path && change.path.includes("auth"))
        summary.push(`🔐 Auth change`);
      if (change.type === "modified" && change.path && change.path.includes("outputFields"))
        summary.push(`📦 Output structure changed`);
    }

    lines.push(`### 🧾 Summary of Changes`);
    for (const item of [...new Set(summary)]) {
      lines.push(`- ${item}`);
    }
    lines.push('');

    // Group changes by category
    for (const [category, catChanges] of Object.entries(categoryMap)) {
      const catTitle = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`### 📂 ${catTitle} Changes`);

      for (const change of catChanges) {
        const emoji = getChangeEmoji(change.type, change.priority);
        
        if (change.type === "file-added") {
          lines.push(`${emoji} New file: \`${change.file}\``);
        } else if (change.type === "file-removed") {
          lines.push(`${emoji} Removed file: \`${change.file}\``);
        } else if (change.type === "folder-added") {
          lines.push(`${emoji} New folder added: \`${change.folder}/\``);
        } else if (change.type === "folder-removed") {
          lines.push(`${emoji} Folder removed: \`${change.folder}/\``);
        } else if (change.type === "added") {
          lines.push(`${emoji} Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``);
        } else if (change.type === "removed") {
          lines.push(`${emoji} Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`);
        } else if (change.type === "modified") {
          lines.push(`${emoji} Changed \`${change.path}\`: \`${formatValue(change.oldVal)}\` → \`${formatValue(change.newVal)}\``);
        }
      }
      
      lines.push('');
    }
  }

  fs.writeFileSync(outputPath, lines.join("\n"), 'utf-8');
}

module.exports = { generateMarkdownReport };
EOF

# Create JSON report generator
cat > src/report-generators/json-report.js << 'EOF'
/**
 * JSON data report generator
 */

const fs = require('fs');

/**
 * Generate JSON report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write JSON file
 */
async function generateJSONReport(reports, outputPath) {
  // Create a formatted JSON string
  const jsonContent = JSON.stringify(reports, null, 2);
  
  // Write the JSON file
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
}

module.exports = { generateJSONReport };
EOF

# Create HTML template
cat > templates/html-template.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Advanced Functional Change Report</title>
  <style>
    :root {
      --color-bg: #ffffff;
      --color-text: #333333;
      --color-primary: #0366d6;
      --color-secondary: #6c757d;
      --color-success: #28a745;
      --color-danger: #dc3545;
      --color-warning: #ffc107;
      --color-info: #17a2b8;
      --color-light: #f8f9fa;
      --color-dark: #343a40;
      --color-p0: #dc3545;
      --color-p1: #ffc107;
      --color-p2: #28a745;
      --color-border: #e1e4e8;
      --color-hover: #f6f8fa;
      --color-code-bg: #f6f8fa;
      --font-mono: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      --shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
    }
    
    [data-theme="dark"] {
      --color-bg: #0d1117;
      --color-text: #c9d1d9;
      --color-primary: #58a6ff;
      --color-secondary: #8b949e;
      --color-success: #3fb950;
      --color-danger: #f85149;
      --color-warning: #d29922;
      --color-info: #58a6ff;
      --color-light: #161b22;
      --color-dark: #c9d1d9;
      --color-p0: #f85149;
      --color-p1: #d29922;
      --color-p2: #3fb950;
      --color-border: #30363d;
      --color-hover: #161b22;
      --color-code-bg: #161b22;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text);
      background-color: var(--color-bg);
      margin: 0;
      padding: 20px;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    /* Layout */
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 10px;
    }
    
    .controls {
      position: sticky;
      top: 0;
      background-color: var(--color-bg);
      z-index: 100;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 20px;
    }
    
    .filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    /* Typography */
    h1 {
      font-size: 24px;
      margin-top: 0;
    }
    
    h2 {
      font-size: 20px;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--color-border);
    }
    
    h3 {
      font-size: 16px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    
    h4 {
      font-size: 14px;
      margin-top: 15px;
      margin-bottom: 10px;
    }
    
    a {
      color: var(--color-primary);
      text-decoration: none;
    }

    a {
      color: var(--color-primary);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    code {
      font-family: var(--font-mono);
      font-size: 85%;
      padding: 0.2em 0.4em;
      background-color: var(--color-code-bg);
      border-radius: 3px;
    }
    
    pre {
      font-family: var(--font-mono);
      font-size: 85%;
      line-height: 1.45;
      background-color: var(--color-code-bg);
      border-radius: 3px;
      overflow: auto;
      padding: 16px;
      margin: 0 0 16px 0;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    
    table th, table td {
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      text-align: left;
    }
    
    table th {
      background-color: var(--color-code-bg);
      font-weight: 600;
    }
    
    table tr:nth-child(even) {
      background-color: var(--color-hover);
    }
    
    /* Details/Summary Styles */
    details {
      margin-bottom: 16px;
    }
    
    details > summary {
      cursor: pointer;
      padding: 8px;
      background-color: var(--color-code-bg);
      border-radius: 3px;
      border: 1px solid var(--color-border);
      font-weight: 600;
    }
    
    details[open] > summary {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom: none;
      margin-bottom: 0;
    }
    
    details > div {
      border: 1px solid var(--color-border);
      border-top: none;
      padding: 8px 16px;
      border-bottom-left-radius: 3px;
      border-bottom-right-radius: 3px;
    }
    
    /* Badge Styles */
    .badge {
      display: inline-block;
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      margin-left: 5px;
    }
    
    .badge-p0 {
      background-color: var(--color-p0);
      color: white;
    }
    
    .badge-p1 {
      background-color: var(--color-p1);
      color: black;
    }
    
    .badge-p2 {
      background-color: var(--color-p2);
      color: white;
    }
    
    /* Change Type Indicators */
    .change-added {
      background-color: rgba(40, 167, 69, 0.2);
    }
    
    .change-removed {
      background-color: rgba(220, 53, 69, 0.2);
    }
    
    .change-modified {
      background-color: rgba(255, 193, 7, 0.2);
    }
    
    /* Progress Bars */
    .progress-container {
      height: 20px;
      background-color: var(--color-code-bg);
      border-radius: 3px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      float: left;
      text-align: center;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
    }
    
    /* Buttons */
    button, .btn {
      display: inline-block;
      font-weight: 400;
      text-align: center;
      vertical-align: middle;
      cursor: pointer;
      padding: 6px 12px;
      font-size: 14px;
      line-height: 1.5;
      border-radius: 3px;
      color: var(--color-text);
      background-color: var(--color-light);
      border: 1px solid var(--color-border);
      transition: all 0.2s ease-in-out;
    }
    
    button:hover, .btn:hover {
      background-color: var(--color-hover);
    }
    
    button:active, .btn:active {
      transform: translateY(1px);
    }
    
    button:focus, .btn:focus {
      outline: none;
      box-shadow: 0 0 0 0.2rem rgba(3, 102, 214, 0.25);
    }
    
    .btn-sm {
      padding: 4px 8px;
      font-size: 12px;
    }
    
    .btn-primary {
      color: white;
      background-color: var(--color-primary);
      border-color: var(--color-primary);
    }
    
    /* Checkbox filters */
    .filter-checkbox {
      display: none;
    }
    
    .filter-label {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      border: 1px solid var(--color-border);
      cursor: pointer;
      margin-right: 5px;
      user-select: none;
    }
    
    .filter-checkbox:checked + .filter-label {
      background-color: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    
    /* Theme Switch */
    .theme-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }
    
    .theme-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .theme-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--color-secondary);
      transition: .4s;
      border-radius: 24px;
    }
    
    .theme-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .theme-slider {
      background-color: var(--color-primary);
    }
    
    input:checked + .theme-slider:before {
      transform: translateX(26px);
    }
    
    /* Back to top button */
    .back-to-top {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      background-color: var(--color-primary);
      color: white;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.3s;
      box-shadow: var(--shadow);
    }
    
    .back-to-top.visible {
      opacity: 1;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .stats-card {
      border: 1px solid var(--color-border);
      border-radius: 3px;
      padding: 15px;
      box-shadow: var(--shadow);
    }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .filter-group {
        flex-direction: column;
      }
    }
    
    /* Print Styles */
    @media print {
      .controls, .back-to-top {
        display: none !important;
      }
      
      body {
        padding: 0;
      }
      
      .container {
        max-width: none;
      }
      
      details {
        break-inside: avoid;
      }
      
      details[open] > summary {
        margin-bottom: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Advanced Functional Change Report</h1>
      <div>
        <span>Theme:</span>
        <label class="theme-switch">
          <input type="checkbox" id="theme-toggle">
          <span class="theme-slider"></span>
        </label>
      </div>
    </div>
    
    <div class="controls" id="controls">
      <div class="search-container">
        <input type="text" id="search-input" class="search-input" placeholder="Search for changes..." autocomplete="off">
        <div id="search-results" class="search-results"></div>
      </div>
      
      <div class="filter-group">
        <strong>Priority:</strong>
        <input type="checkbox" id="filter-p0" class="filter-checkbox" checked>
        <label for="filter-p0" class="filter-label badge-p0">Critical</label>
        
        <input type="checkbox" id="filter-p1" class="filter-checkbox" checked>
        <label for="filter-p1" class="filter-label badge-p1">Major</label>
        
        <input type="checkbox" id="filter-p2" class="filter-checkbox" checked>
        <label for="filter-p2" class="filter-label badge-p2">Minor</label>
      </div>
      
      <div class="filter-group">
        <strong>Type:</strong>
        <input type="checkbox" id="filter-added" class="filter-checkbox" checked>
        <label for="filter-added" class="filter-label">Added</label>
        
        <input type="checkbox" id="filter-removed" class="filter-checkbox" checked>
        <label for="filter-removed" class="filter-label">Removed</label>
        
        <input type="checkbox" id="filter-modified" class="filter-checkbox" checked>
        <label for="filter-modified" class="filter-label">Modified</label>
      </div>
      
      <div class="filter-group">
        <strong>Category:</strong>
        <div id="category-filters">
          <!-- Dynamically generated based on available categories -->
        </div>
      </div>
      
      <div class="export-group">
        <button id="btn-export-pdf" class="btn btn-sm">📄 Export PDF</button>
        <button id="btn-export-html" class="btn btn-sm">💾 Export HTML</button>
        <button id="btn-export-md" class="btn btn-sm">📝 Export Markdown</button>
        <button id="btn-export-json" class="btn btn-sm">{ } Export JSON</button>
        <button id="btn-reset-filters" class="btn btn-sm btn-primary">🔄 Reset Filters</button>
      </div>
    </div>
    
    <div id="stats-summary">
      <!-- Statistics summary will be generated here -->
    </div>
    
    <div id="table-of-contents">
      <!-- Table of contents will be generated here -->
    </div>
    
    <div id="executive-summary">
      <!-- Executive summary will be generated here -->
    </div>
    
    <div id="report-content">
      <!-- Report content will be generated here -->
    </div>
  </div>
  
  <div class="back-to-top" id="back-to-top">↑</div>
  
  <script src="../templates/scripts/filters.js"></script>
  <script src="../templates/scripts/visualizations.js"></script>
  <script src="../templates/scripts/interactivity.js"></script>
  <script>
    // Collect all categories
  for (const { changes } of reportData) {
    for (const change of changes) {
      if (change.category) {
        categories[change.category] = true;
        // Initialize filter state
        filterState.category[change.category] = true;
      }
    }
  }
  
  // Create filter checkboxes
  for (const category of Object.keys(categories).sort()) {
    const id = `filter-${category}`;
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.className = 'filter-checkbox';
    input.checked = true;
    input.dataset.category = category;
    
    const label = document.createElement('label');
    label.htmlFor = id;
    label.className = 'filter-label';
    label.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    
    categoryFilters.appendChild(input);
    categoryFilters.appendChild(label);
  }
}

// Generate report content
function generateReportContent() {
  const reportElement = document.getElementById('report-content');
  let reportHTML = '';
  
  // Generate connector sections
  for (const { connector, changes } of reportData) {
    if (changes.length === 0) continue;
    
    // Determine if connector has critical changes
    const hasCritical = changes.some(c => c.priority === 'P0');
    
    reportHTML += `
      <h2 id="connector-${connector}">🔌 Connector: ${connector}</h2>
      <details ${hasCritical ? 'open' : ''}>
        <summary><strong>Changes (${changes.length})</strong></summary>
    `;
    
    // Generate change summary
    const summary = [];
    if (changes.some(c => c.type === 'file-added')) {
      summary.push('🆕 New files added');
    }
    if (changes.some(c => c.type === 'file-removed')) {
      summary.push('🗑️ Files removed');
    }
    if (changes.some(c => c.type === 'folder-added')) {
      summary.push('📁 New folders added');
    }
    if (changes.some(c => c.type === 'folder-removed')) {
      summary.push('📁 Folders removed');
    }
    if (changes.some(c => c.type === 'modified' && c.path && c.path.includes('auth'))) {
      summary.push('🔐 Auth changes');
    }
    if (changes.some(c => c.type === 'modified' && c.path && c.path.includes('outputFields'))) {
      summary.push('📦 Output structure changes');
    }
    
    reportHTML += '<h3>🧾 Summary of Changes</h3><ul>';
    for (const item of summary) {
      reportHTML += `<li>${item}</li>`;
    }
    reportHTML += '</ul>';
    
    // Group changes by priority
    const changesByPriority = {
      P0: [],
      P1: [],
      P2: []
    };
    
    for (const change of changes) {
      changesByPriority[change.priority].push(change);
    }
    
    // Priority icons
    const priorityIcons = {
      P0: '🔴 Critical',
      P1: '🟠 Major',
      P2: '🟢 Minor'
    };
    
    // Show changes grouped by priority
    for (const priority of ['P0', 'P1', 'P2']) {
      const priorityChanges = changesByPriority[priority];
      if (priorityChanges.length === 0) continue;
      
      const openByDefault = priority === 'P0';
      
      reportHTML += `
        <h3>${priorityIcons[priority]} Changes (${priorityChanges.length})</h3>
        <details ${openByDefault ? 'open' : ''}>
          <summary><strong>${priority === 'P0' ? 'Critical' : priority === 'P1' ? 'Major' : 'Minor'} Changes</strong></summary>
      `;
      
      // Group by category
      const categorizedChanges = {};
      for (const change of priorityChanges) {
        const category = change.category || 'general';
        if (!categorizedChanges[category]) {
          categorizedChanges[category] = [];
        }
        categorizedChanges[category].push(change);
      }
      
      // Display changes by category
      for (const [category, categoryChanges] of Object.entries(categorizedChanges)) {
        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        
        if (Object.keys(categorizedChanges).length > 1) {
          reportHTML += `<h4>📂 ${categoryTitle}</h4>`;
        }
        
        // Display each change
        for (const change of categoryChanges) {
          const emoji = getChangeEmoji(change.type, change.priority);
          const anchor = `${connector}-${change.category}-${change.type}-${change.path || change.file || change.folder}`.replace(/[^\w-]/g, '-');
          
          reportHTML += `<div id="${anchor}" data-priority="${change.priority}" data-type="${change.type}" data-category="${change.category}" class="change-item">`;
          
          if (change.type === 'file-added') {
            reportHTML += `<p>${emoji} <strong>New file:</strong> <code>${change.file}</code></p>`;
          } else if (change.type === 'file-removed') {
            reportHTML += `<p>${emoji} <strong>Removed file:</strong> <code>${change.file}</code></p>`;
          } else if (change.type === 'folder-added') {
            reportHTML += `<p>${emoji} <strong>New folder added:</strong> <code>${change.folder}/</code></p>`;
          } else if (change.type === 'folder-removed') {
            reportHTML += `<p>${emoji} <strong>Folder removed:</strong> <code>${change.folder}/</code></p>`;
          } else if (change.type === 'added') {
            reportHTML += `
              <p>${emoji} <strong>Added:</strong> <code>${change.path}</code></p>
              <pre><code class="change-added">${JSON.stringify(change.newVal, null, 2)}</code></pre>
            `;
          } else if (change.type === 'removed') {
            reportHTML += `
              <p>${emoji} <strong>Removed:</strong> <code>${change.path}</code></p>
              <pre><code class="change-removed">${JSON.stringify(change.oldVal, null, 2)}</code></pre>
            `;
          } else if (change.type === 'modified') {
            // Word-level diff highlighting for simple values
            const isSimpleValue = (
              (typeof change.oldVal !== 'object' || change.oldVal === null) &&
              (typeof change.newVal !== 'object' || change.newVal === null)
            );
            
            reportHTML += `<p>${emoji} <strong>Changed:</strong> <code>${change.path}</code></p>`;
            
            if (isSimpleValue) {
              // For simple values, show inline diff
              const oldStr = String(change.oldVal);
              const newStr = String(change.newVal);
              
              reportHTML += `
                <div class="inline-diff">
                  <p><strong>Before:</strong> <code class="change-removed">${oldStr}</code></p>
                  <p><strong>After:</strong> <code class="change-added">${newStr}</code></p>
                </div>
              `;
            } else {
              // For complex objects, show side-by-side comparison
              reportHTML += `
                <table>
                  <tr>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                  <tr>
                    <td><pre><code class="change-removed">${JSON.stringify(change.oldVal, null, 2)}</code></pre></td>
                    <td><pre><code class="change-added">${JSON.stringify(change.newVal, null, 2)}</code></pre></td>
                  </tr>
                </table>
              `;
            }
          }
          
          reportHTML += '</div>';
        }
      }
      
      reportHTML += '</details>';
    }
    
    reportHTML += `
      </details>
      <p><a href="#table-of-contents">Back to Table of Contents</a></p>
    `;
  }
  
  reportElement.innerHTML = reportHTML;
}

// Setup event listeners
function setupEventListeners() {
  // Priority filters
  document.getElementById('filter-p0').addEventListener('change', function() {
    filterState.priority.P0 = this.checked;
    applyFilters();
    updateUrlParams();
  });
  
  document.getElementById('filter-p1').addEventListener('change', function() {
    filterState.priority.P1 = this.checked;
    applyFilters();
    updateUrlParams();
  });
  
  document.getElementById('filter-p2').addEventListener('change', function() {
    filterState.priority.P2 = this.checked;
    applyFilters();
    updateUrlParams();
  });
  
  // Type filters
  document.getElementById('filter-added').addEventListener('change', function() {
    filterState.type.added = this.checked;
    filterState.type['file-added'] = this.checked;
    filterState.type['folder-added'] = this.checked;
    applyFilters();
    updateUrlParams();
  });
  
  document.getElementById('filter-removed').addEventListener('change', function() {
    filterState.type.removed = this.checked;
    filterState.type['file-removed'] = this.checked;
    filterState.type['folder-removed'] = this.checked;
    applyFilters();
    updateUrlParams();
  });
  
  document.getElementById('filter-modified').addEventListener('change', function() {
    filterState.type.modified = this.checked;
    applyFilters();
    updateUrlParams();
  });
  
  // Category filters
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      filterState.category[this.dataset.category] = this.checked;
      applyFilters();
      updateUrlParams();
    });
  });
  
  // Search input
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', function() {
    filterState.search = this.value.toLowerCase();
    applyFilters();
    updateUrlParams();
  });
  
  // Reset filters button
  document.getElementById('btn-reset-filters').addEventListener('click', function() {
    resetFilters();
  });
  
  // Export buttons
  document.getElementById('btn-export-pdf').addEventListener('click', function() {
    window.print();
  });
  
  document.getElementById('btn-export-html').addEventListener('click', function() {
    exportHTML();
  });
  
  document.getElementById('btn-export-md').addEventListener('click', function() {
    exportMarkdown();
  });
  
  document.getElementById('btn-export-json').addEventListener('click', function() {
    exportJSON();
  });
}

// Setup back to top button
function setupBackToTop() {
  const backToTopButton = document.getElementById('back-to-top');
  
  // Show button when page is scrolled down
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  });
  
  // Scroll to top when button is clicked
  backToTopButton.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Export functions
function exportHTML() {
  // Create a standalone version of the current page
  const htmlContent = document.documentElement.outerHTML;
  
  // Create a blob and download link
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'functional-change-report.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMarkdown() {
  // Use backend to generate markdown
  window.location.href = 'functional-change-report.md';
}

function exportJSON() {
  // Use backend to get JSON data
  window.location.href = 'functional-change-data.json';
}
EOF

# Create the main script to run after setup
cat > run-detection.sh << 'EOF'
#!/bin/bash

# Run the functional change detection script
node src/index.js
EOF

# Make the run script executable
chmod +x run-detection.sh

# Create a package.json file
cat > package.json << 'EOF'
{
  "name": "functional-change-detection",
  "version": "1.0.0",
  "description": "Advanced JSON Functional Change Detection Tool",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "json",
    "diff",
    "change-detection"
  ],
  "author": "",
  "license": "MIT"
}
EOF

# Make the shell script executable
chmod +x setup-project.sh

echo "Setup script has been created and made executable."
echo "Run ./setup-project.sh to set up the project structure."
echo "Then run ./run-detection.sh to analyze and generate reports."
 Store the report data as a JavaScript object
    const reportData = {{REPORT_DATA}};
    const statsData = {{STATS_DATA}};
  </script>
</body>
</html>
EOF

# Create JavaScript files for the template
mkdir -p templates/scripts

# Create filters.js
cat > templates/scripts/filters.js << 'EOF'
/**
 * Filtering functionality
 */

// Track current filter state
const filterState = {
  priority: {
    P0: true,
    P1: true,
    P2: true
  },
  type: {
    added: true,
    removed: true,
    modified: true,
    'file-added': true,
    'file-removed': true,
    'folder-added': true,
    'folder-removed': true
  },
  category: {},
  search: ''
};

// Apply filters to the report
function applyFilters() {
  const searchResults = document.getElementById('search-results');
  let matchCount = 0;
  let totalCount = 0;
  
  // Process each change item
  const changeItems = document.querySelectorAll('.change-item');
  changeItems.forEach(item => {
    const priority = item.dataset.priority;
    const type = item.dataset.type;
    const category = item.dataset.category;
    
    totalCount++;
    
    // Check if item matches all filters
    const matchesPriority = filterState.priority[priority];
    const matchesType = filterState.type[type];
    const matchesCategory = filterState.category[category];
    
    // Check if item matches search
    const matchesSearch = filterState.search === '' || 
      item.textContent.toLowerCase().includes(filterState.search);
    
    const isVisible = matchesPriority && matchesType && matchesCategory && matchesSearch;
    
    // Show/hide item
    item.style.display = isVisible ? 'block' : 'none';
    
    if (isVisible) matchCount++;
  });
  
  // Update search results
  if (filterState.search !== '') {
    searchResults.textContent = `Found ${matchCount} matches`;
    searchResults.style.display = 'block';
  } else {
    searchResults.style.display = 'none';
  }
  
  // Update executive summary items
  const summaryItems = document.querySelectorAll('#executive-summary li');
  summaryItems.forEach(item => {
    const priority = item.dataset.priority;
    const type = item.dataset.type;
    const category = item.dataset.category;
    
    const matchesPriority = filterState.priority[priority];
    const matchesType = filterState.type[type];
    const matchesCategory = filterState.category[category];
    const matchesSearch = filterState.search === '' || 
      item.textContent.toLowerCase().includes(filterState.search);
    
    item.style.display = (matchesPriority && matchesType && matchesCategory && matchesSearch) ? 'list-item' : 'none';
  });
}

// Reset all filters
function resetFilters() {
  // Reset priority filters
  filterState.priority.P0 = true;
  filterState.priority.P1 = true;
  filterState.priority.P2 = true;
  
  document.getElementById('filter-p0').checked = true;
  document.getElementById('filter-p1').checked = true;
  document.getElementById('filter-p2').checked = true;
  
  // Reset type filters
  filterState.type.added = true;
  filterState.type['file-added'] = true;
  filterState.type['folder-added'] = true;
  filterState.type.removed = true;
  filterState.type['file-removed'] = true;
  filterState.type['folder-removed'] = true;
  filterState.type.modified = true;
  
  document.getElementById('filter-added').checked = true;
  document.getElementById('filter-removed').checked = true;
  document.getElementById('filter-modified').checked = true;
  
  // Reset category filters
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    checkbox.checked = true;
    filterState.category[checkbox.dataset.category] = true;
  });
  
  // Reset search
  document.getElementById('search-input').value = '';
  filterState.search = '';
  
  // Apply filters
  applyFilters();
  updateUrlParams();
}

// Update URL parameters to reflect current filter state
function updateUrlParams() {
  const params = new URLSearchParams();
  
  // Add priority params
  if (!filterState.priority.P0) params.append('p0', 'false');
  if (!filterState.priority.P1) params.append('p1', 'false');
  if (!filterState.priority.P2) params.append('p2', 'false');
  
  // Add type params
  if (!filterState.type.added) params.append('added', 'false');
  if (!filterState.type.removed) params.append('removed', 'false');
  if (!filterState.type.modified) params.append('modified', 'false');
  
  // Add category params
  for (const [category, enabled] of Object.entries(filterState.category)) {
    if (!enabled) params.append(`cat_${category}`, 'false');
  }
  
  // Add search param
  if (filterState.search) params.append('search', filterState.search);
  
  // Update URL without reloading page
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', newUrl);
}

// Apply URL parameters
function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  
  // Apply priority params
  if (params.get('p0') === 'false') {
    filterState.priority.P0 = false;
    document.getElementById('filter-p0').checked = false;
  }
  
  if (params.get('p1') === 'false') {
    filterState.priority.P1 = false;
    document.getElementById('filter-p1').checked = false;
  }
  
  if (params.get('p2') === 'false') {
    filterState.priority.P2 = false;
    document.getElementById('filter-p2').checked = false;
  }
  
  // Apply type params
  if (params.get('added') === 'false') {
    filterState.type.added = false;
    filterState.type['file-added'] = false;
    filterState.type['folder-added'] = false;
    document.getElementById('filter-added').checked = false;
  }
  
  if (params.get('removed') === 'false') {
    filterState.type.removed = false;
    filterState.type['file-removed'] = false;
    filterState.type['folder-removed'] = false;
    document.getElementById('filter-removed').checked = false;
  }
  
  if (params.get('modified') === 'false') {
    filterState.type.modified = false;
    document.getElementById('filter-modified').checked = false;
  }
  
  // Apply category params
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    const category = checkbox.dataset.category;
    if (params.get(`cat_${category}`) === 'false') {
      filterState.category[category] = false;
      checkbox.checked = false;
    }
  });
  
  // Apply search param
  const searchValue = params.get('search');
  if (searchValue) {
    filterState.search = searchValue;
    document.getElementById('search-input').value = searchValue;
  }
  
  // Apply filters
  applyFilters();
}
EOF

# Create visualizations.js
cat > templates/scripts/visualizations.js << 'EOF'
/**
 * Visualization and stats functionality
 */

// Generate statistics summary with visualizations
function generateStatsSummary() {
  const statsElement = document.getElementById('stats-summary');
  
  statsElement.innerHTML = `
    <h2>📊 Change Statistics</h2>
    <details open>
      <summary><strong>Statistics Overview</strong></summary>
      <div class="stats-grid">
        <div class="stats-card">
          <h3>Changes by Priority</h3>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P0, getTotalChanges())}%; background-color: var(--color-p0);" title="Critical: ${statsData.priority.P0}">
              ${statsData.priority.P0}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P1, getTotalChanges())}%; background-color: var(--color-p1);" title="Major: ${statsData.priority.P1}">
              ${statsData.priority.P1}
            </div>
            <div class="progress-bar" style="width: ${getPercentage(statsData.priority.P2, getTotalChanges())}%; background-color: var(--color-p2);" title="Minor: ${statsData.priority.P2}">
              ${statsData.priority.P2}
            </div>
          </div>
          <p>
            <span class="badge badge-p0">${statsData.priority.P0} Critical</span>
            <span class="badge badge-p1">${statsData.priority.P1} Major</span>
            <span class="badge badge-p2">${statsData.priority.P2} Minor</span>
          </p>
        </div>
        
        <div class="stats-card">
          <h3>Changes by Type</h3>
          <ul>
            <li>🆕 Added: ${statsData.changeTypes.added + statsData.changeTypes['file-added'] + statsData.changeTypes['folder-added']}</li>
            <li>❌ Removed: ${statsData.changeTypes.removed + statsData.changeTypes['file-removed'] + statsData.changeTypes['folder-removed']}</li>
            <li>✏️ Modified: ${statsData.changeTypes.modified}</li>
          </ul>
        </div>
        
        <div class="stats-card">
          <h3>Top Categories</h3>
          <ul>
            ${Object.entries(statsData.categories)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 3)
              .map(([category, data]) => `
                <li>${category}: ${data.total} changes (${data.P0} critical)</li>
              `).join('')}
          </ul>
        </div>
      </div>
    </details>
  `;
}

// Get total number of changes
function getTotalChanges() {
  return statsData.priority.P0 + statsData.priority.P1 + statsData.priority.P2;
}

// Calculate percentage
function getPercentage(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Generate table of contents
function generateTableOfContents() {
  const tocElement = document.getElementById('table-of-contents');
  
  let tocHTML = `
    <h2>📖 Table of Contents</h2>
    <details open>
      <summary><strong>Navigation</strong></summary>
      <ul>
  `;
  
  // Add executive summary link
  tocHTML += `<li><a href="#executive-summary">Executive Summary</a></li>`;
  
  // Add connector links
  for (const { connector, changes } of reportData) {
    if (changes.length === 0) continue;
    
    const p0Count = changes.filter(c => c.priority === 'P0').length;
    const p1Count = changes.filter(c => c.priority === 'P1').length;
    const p2Count = changes.filter(c => c.priority === 'P2').length;
    
    const badges = [];
    if (p0Count > 0) badges.push(`<span class="badge badge-p0">${p0Count}</span>`);
    if (p1Count > 0) badges.push(`<span class="badge badge-p1">${p1Count}</span>`);
    if (p2Count > 0) badges.push(`<span class="badge badge-p2">${p2Count}</span>`);
    
    tocHTML += `<li><a href="#connector-${connector}">${connector}</a> ${badges.join(' ')}</li>`;
  }
  
  tocHTML += `
      </ul>
    </details>
  `;
  
  tocElement.innerHTML = tocHTML;
}

// Generate executive summary
function generateExecutiveSummary() {
  const executiveSummaryElement = document.getElementById('executive-summary');
  const criticalChanges = [];
  
  // Collect critical and major changes
  for (const { connector, changes } of reportData) {
    for (const change of changes) {
      if (change.priority === 'P0' || change.priority === 'P1') {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  // Sort by priority, then connector
  criticalChanges.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'P0' ? -1 : 1;
    }
    return a.connector.localeCompare(b.connector);
  });
  
  if (criticalChanges.length === 0) {
    executiveSummaryElement.innerHTML = `
      <h2 id="executive-summary">🚨 Executive Summary</h2>
      <p>No critical or major changes detected.</p>
    `;
    return;
  }
  
  // Group by connector
  const criticalByConnector = {};
  for (const change of criticalChanges) {
    if (!criticalByConnector[change.connector]) {
      criticalByConnector[change.connector] = [];
    }
    criticalByConnector[change.connector].push(change);
  }
  
  let summaryHTML = `
    <h2 id="executive-summary">🚨 Executive Summary</h2>
    <details open>
      <summary><strong>Critical and Major Changes (${criticalChanges.length})</strong></summary>
  `;
  
  // List critical changes by connector
  for (const [connector, changes] of Object.entries(criticalByConnector)) {
    summaryHTML += `<h3>${connector}</h3><ul>`;
    
    for (const change of changes) {
      const emoji = getChangeEmoji(change.type, change.priority);
      const priority = change.priority === 'P0' ? '🔴' : '🟠';
      
      // Create anchor link
      const anchor = `${connector}-${change.category}-${change.type}-${change.path || change.file || change.folder}`.replace(/[^\w-]/g, '-');
      
      let description;
      if (change.type === 'file-added') {
        description = `Added file: <code>${change.file}</code>`;
      } else if (change.type === 'file-removed') {
        description = `Removed file: <code>${change.file}</code>`;
      } else if (change.type === 'folder-added') {
        description = `Added folder: <code>${change.folder}/</code>`;
      } else if (change.type === 'folder-removed') {
        description = `Removed folder: <code>${change.folder}/</code>`;
      } else if (change.type === 'added') {
        description = `Added <code>${change.path}</code>`;
      } else if (change.type === 'removed') {
        description = `Removed <code>${change.path}</code>`;
      } else if (change.type === 'modified') {
        description = `Changed <code>${change.path}</code>`;
      }
      
      summaryHTML += `<li data-priority="${change.priority}" data-type="${change.type}" data-category="${change.category}">${priority} ${emoji} ${description} <a href="#${anchor}">(details)</a></li>`;
    }
    
    summaryHTML += '</ul>';
  }
  
  summaryHTML += '</details>';
  executiveSummaryElement.innerHTML = summaryHTML;
}

// Get emoji for change type
function getChangeEmoji(type, priority) {
  switch (type) {
    case 'file-added':
    case 'folder-added':
    case 'added':
      return '➕';
    case 'file-removed':
    case 'folder-removed':
    case 'removed':
      return '❌';
    case 'modified':
      return '✏️';
    default:
      // Use priority-based emoji for other cases
      if (priority === 'P0') return '🚨';
      if (priority === 'P1') return '⚠️';
      return 'ℹ️';
  }
}
EOF

# Create interactivity.js
cat > templates/scripts/interactivity.js << 'EOF'
/**
 * UI interactions and event handlers
 */

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Setup theme toggle
  initTheme();
  
  // Generate category filters
  generateCategoryFilters();
  
  // Generate statistics summary
  generateStatsSummary();
  
  // Generate table of contents
  generateTableOfContents();
  
  // Generate executive summary
  generateExecutiveSummary();
  
  // Generate full report content
  generateReportContent();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup back to top button
  setupBackToTop();
  
  // Apply URL parameters if any
  applyUrlParams();
});

// Initialize theme based on preferences
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('theme');
  
  if (storedTheme === 'dark' || (!storedTheme && prefersDarkMode)) {
    document.body.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
  }
  
  themeToggle.addEventListener('change', function() {
    if (this.checked) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  });
}

// Generate category filters based on available categories
function generateCategoryFilters() {
  const categoryFilters = document.getElementById('category-filters');
  const categories = {};
  
  //#!/bin/bash

# Script to set up the directory structure and files for the enhanced change detection project

# Create the directory structure
mkdir -p src/report-generators src/utils templates/scripts

# Create the main entry point
cat > src/index.js << 'EOF'
/**
 * Advanced JSON Functional Change Detection
 * Main entry point
 */

const path = require('path');
const { compareConnectors } = require('./comparator');
const { generateHTMLReport } = require('./report-generators/html-report');
const { generateMarkdownReport } = require('./report-generators/markdown-report');
const { generateJSONReport } = require('./report-generators/json-report');

// Paths to connector directories
const prevPath = path.join(__dirname, '..', 'connectors', 'previous');
const currPath = path.join(__dirname, '..', 'connectors', 'current');

async function run() {
  console.log("🔍 Starting functional change detection...");
  
  // Compare connectors
  console.log(`📂 Analyzing connectors in ${prevPath} and ${currPath}...`);
  const comparisonResult = await compareConnectors(prevPath, currPath);
  
  // Generate reports
  console.log("📝 Generating reports...");
  
  // Generate HTML report
  await generateHTMLReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.html'));
  console.log("✅ HTML report generated: functional-change-report.html");
  
  // Generate Markdown report
  await generateMarkdownReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.md'));
  console.log("✅ Markdown report generated: functional-change-report.md");
  
  // Generate JSON report
  await generateJSONReport(comparisonResult, path.join(__dirname, '..', 'functional-change-data.json'));
  console.log("✅ JSON data generated: functional-change-data.json");
  
  console.log("✨ Process complete!");
}

// Run the program
run().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});
EOF

# Create the comparator module
cat > src/comparator.js << 'EOF'
/**
 * JSON comparison module
 * Compares JSON structures between two connector versions
 */

const fs = require('fs');
const path = require('path');
const { loadJSON, collectJSONFiles } = require('./utils/file-utils');
const { determinePriority } = require('./prioritizer');

// List of known subfolders to inspect in each connector
const SUBFOLDERS = ["actions", "auth", "events", "meta", "metadata"];

/**
 * Deeply compares two objects and returns the differences
 * @param {Object} oldObj - The old object
 * @param {Object} newObj - The new object
 * @param {string} pathPrefix - Prefix for the property path
 * @returns {Array} - Array of change objects
 */
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
    else if (typeof oldVal === "object" && oldVal !== null && 
             typeof newVal === "object" && newVal !== null &&
             !Array.isArray(oldVal) && !Array.isArray(newVal)) {
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

/**
 * Compares connectors between previous and current versions
 * @param {string} prevPath - Path to previous connector directory
 * @param {string} currPath - Path to current connector directory
 * @returns {Array} - Comparison results for each connector
 */
async function compareConnectors(prevPath, currPath) {
  // Validate paths
  if (!fs.existsSync(prevPath)) {
    throw new Error(`Previous directory not found: ${prevPath}`);
  }
  
  if (!fs.existsSync(currPath)) {
    throw new Error(`Current directory not found: ${currPath}`);
  }

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
            priority: determinePriority({ 
              type: "file-added", 
              file: `${subfolder}/${file}`, 
              category: subfolder 
            })
          });
        } else if (!newJson) {
          report.changes.push({
            type: "file-removed",
            file: `${subfolder}/${file}`,
            category: subfolder,
            priority: determinePriority({ 
              type: "file-removed", 
              file: `${subfolder}/${file}`, 
              category: subfolder 
            })
          });
        } else {
          const diffs = diffObjects(
            oldJson,
            newJson,
            `${subfolder}/${file.replace(".json", "")}`
          );
          
          // Add category and priority to each diff
          const enhancedDiffs = diffs.map(diff => ({
            ...diff,
            category: subfolder,
            priority: determinePriority({
              ...diff,
              category: subfolder
            })
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
            category: subfolder 
          })
        });
      } else if (fs.existsSync(prevSub) && !fs.existsSync(currSub)) {
        report.changes.push({
          type: "folder-removed",
          folder: subfolder,
          category: subfolder,
          priority: determinePriority({ 
            type: "folder-removed", 
            folder: subfolder, 
            category: subfolder 
          })
        });
      }
    }

    results.push(report);
  }

  return results;
}

module.exports = { compareConnectors, diffObjects };
EOF

# Create the prioritizer module
cat > src/prioritizer.js << 'EOF'
/**
 * Priority classifier module
 * Determines priority levels for different types of changes
 */

// Priority levels for different types of changes
const PRIORITY_LEVELS = {
  P0: "Critical", // Authentication, security-related fields
  P1: "Major",    // New actions, removed features, altered structure
  P2: "Minor"     // Description updates, cosmetic changes
};

// Priority mapping rules
const PRIORITY_RULES = {
  // P0 - Critical changes
  "auth/": "P0",
  "security": "P0",
  "permissions": "P0",
  "authentication": "P0",
  "authorization": "P0",
  
  // P1 - Major changes
  "actions/": "P1",
  "events/": "P1",
  "file-added": "P1",
  "file-removed": "P1",
  "folder-added": "P1",
  "folder-removed": "P1",
  "endpoint": "P1",
  "httpMethod": "P1",
  "inputFields": "P1",
  "outputFields": "P1",
  "trigger": "P1",
  "payload": "P1",
  
  // Default to P2 - Minor changes
  "default": "P2"
};

/**
 * Determine priority level based on change type and path
 * @param {Object} change - The change object
 * @returns {string} - Priority level (P0, P1, P2)
 */
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
    if (change.type === "modified" && (
      (typeof change.oldVal === "string" && change.oldVal.includes(pattern)) ||
      (typeof change.newVal === "string" && change.newVal.includes(pattern))
    )) {
      return priority; 
    }
  }
  
  // Default to P2 - Minor changes
  return PRIORITY_RULES.default;
}

/**
 * Get emoji for change type
 * @param {string} type - Type of change
 * @param {string} priority - Priority level
 * @returns {string} - Emoji representation
 */
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

/**
 * Generate statistics for visualization
 * @param {Array} reports - Array of connector reports
 * @returns {Object} - Statistics object
 */
function generateStats(reports) {
  const stats = {
    priority: { P0: 0, P1: 0, P2: 0 },
    changeTypes: {
      added: 0,
      removed: 0,
      modified: 0,
      'file-added': 0,
      'file-removed': 0,
      'folder-added': 0,
      'folder-removed': 0
    },
    categories: {},
    connectors: {}
  };
  
  for (const { connector, changes } of reports) {
    stats.connectors[connector] = {
      total: changes.length,
      P0: 0,
      P1: 0,
      P2: 0,
    };
    
    for (const change of changes) {
      // Count by priority
      stats.priority[change.priority]++;
      stats.connectors[connector][change.priority]++;
      
      // Count by change type
      stats.changeTypes[change.type]++;
      
      // Count by category
      if (!stats.categories[change.category]) {
        stats.categories[change.category] = {
          total: 0,
          P0: 0,
          P1: 0,
          P2: 0
        };
      }
      stats.categories[change.category].total++;
      stats.categories[change.category][change.priority]++;
    }
  }
  
  return stats;
}

module.exports = { 
  PRIORITY_LEVELS, 
  determinePriority, 
  getChangeEmoji,
  generateStats
};
EOF

# Create file utilities module
cat > src/utils/file-utils.js << 'EOF'
/**
 * File utility functions
 */

const fs = require('fs');
const path = require('path');

/**
 * Load and parse JSON file safely
 * @param {string} filepath - Path to JSON file
 * @returns {Object|null} - Parsed JSON or null if error
 */
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (e) {
    console.error(`❌ Error parsing ${filepath}: ${e.message}`);
    return null;
  }
}

/**
 * Recursively collect all .json files in a given folder
 * @param {string} basePath - Base directory path
 * @returns {Object} - Object mapping filenames to parsed JSON content
 */
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

/**
 * Format JSON value for display (with truncation for large values)
 * @param {any} value - Value to format
 * @param {number} truncateLength - Length at which to truncate
 * @returns {string} - Formatted value
 */
function formatValue(value, truncateLength = 80) {
  const json = JSON.stringify(value);
  if (json.length <= truncateLength) return json;
  return json.substring(0, truncateLength) + "...";
}

module.exports = {
  loadJSON,
  collectJSONFiles,
  formatValue
};
EOF

# Create diff utilities module
cat > src/utils/diff-utils.js << 'EOF'
/**
 * Diff utility functions
 */

/**
 * Word-level diff algorithm for highlighting specific changes
 * @param {string|Object} oldStr - Old string or value
 * @param {string|Object} newStr - New string or value
 * @returns {Object} - Diff result
 */
function diffWords(oldStr, newStr) {
  // Convert objects to strings if needed
  if (typeof oldStr !== 'string') oldStr = JSON.stringify(oldStr, null, 2);
  if (typeof newStr !== 'string') newStr = JSON.stringify(newStr, null, 2);
  
  // Simple character diff implementation (in a real implementation, use a proper diff library)
  const oldWords = oldStr.split(/(\s+|\b)/);
  const newWords = newStr.split(/(\s+|\b)/);
  
  let i = 0, j = 0;
  const result = {
    removed: [],
    added: [],
    unchanged: []
  };
  
  // This is a simplified diff - a production version would use a proper diff algorithm
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      // All remaining words in newWords are added
      while (j < newWords.length) {
        result.added.push(j++);
      }
      break;
    }
    
    if (j >= newWords.length) {
      // All remaining words in oldWords are removed
      while (i < oldWords.length) {
        result.removed.push(i++);
      }
      break;
    }
    
    if (oldWords[i] === newWords[j]) {
      result.unchanged.push(j);
      i++;
      j++;
    } else {
      // Try to find the old word later in the new words
      const oldWordPos = newWords.indexOf(oldWords[i], j);
      // Try to find the new word later in the old words
      const newWordPos = oldWords.indexOf(newWords[j], i);
      
      if (oldWordPos === -1 && newWordPos === -1) {
        // Both words are different
        result.removed.push(i++);
        result.added.push(j++);
      } else if (newWordPos === -1 || (oldWordPos !== -1 && oldWordPos <= newWordPos)) {
        // Word was added
        result.added.push(j++);
      } else {
        // Word was removed
        result.removed.push(i++);
      }
    }
  }
  
  return {
    oldWords,
    newWords,
    diff: result
  };
}

module.exports = {
  diffWords
};
EOF

# Create HTML report generator
cat > src/report-generators/html-report.js << 'EOF'
/**
 * HTML report generator
 */

const fs = require('fs');
const path = require('path');
const { generateStats } = require('../prioritizer');

/**
 * Generate HTML report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write HTML file
 */
async function generateHTMLReport(reports, outputPath) {
  const stats = generateStats(reports);
  
  // Read the HTML template
  const templatePath = path.join(__dirname, '../../templates/html-template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');
  
  // Replace placeholders with data
  template = template.replace('{{REPORT_DATA}}', JSON.stringify(reports));
  template = template.replace('{{STATS_DATA}}', JSON.stringify(stats));
  
  // Write the HTML report
  fs.writeFileSync(outputPath, template, 'utf-8');
}

module.exports = { generateHTMLReport };
EOF

# Create Markdown report generator
cat > src/report-generators/markdown-report.js << 'EOF'
/**
 * Markdown report generator
 */

const fs = require('fs');
const { getChangeEmoji } = require('../prioritizer');
const { formatValue } = require('../utils/file-utils');
const { generateStats } = require('../prioritizer');

/**
 * Generate Markdown report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write Markdown file
 */
async function generateMarkdownReport(reports, outputPath) {
  const stats = generateStats(reports);
  const lines = ["# 📋 Functional Change Report\n"];
  
  // Add priority counts summary
  lines.push(`> **Change Summary:** ${stats.priority.P0} Critical, ${stats.priority.P1} Major, ${stats.priority.P2} Minor changes\n`);
  
  // Collect critical changes for executive summary
  const criticalChanges = [];
  for (const { connector, changes } of reports) {
    for (const change of changes) {
      if (change.priority === "P0" || change.priority === "P1") {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  // Create executive summary if there are any critical changes
  if (criticalChanges.length > 0) {
    lines.push(`## 🚨 Executive Summary\n`);
    
    // Group by connector
    const criticalByConnector = {};
    for (const change of criticalChanges) {
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
        
        let description;
        if (change.type === "file-added") {
          description = `Added file: \`${change.file}\``;
        } else if (change.type === "file-removed") {
          description = `Removed file: \`${change.file}\``;
        } else if (change.type === "folder-added") {
          description = `Added folder: \`${change.folder}/\``;
        } else if (change.type === "folder-removed") {
          description = `Removed folder: \`${change.folder}/\``;
        } else if (change.type === "added") {
          description = `Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``;
        } else if (change.type === "removed") {
          description = `Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`;
        } else if (change.type === "modified") {
          description = `Changed \`${change.path}\``;
        }
        
        lines.push(`- ${priority} ${emoji} ${description}`);
      }
      
      lines.push('');
    }
  }
  
  // Detailed changes by connector
  for (const { connector, changes } of reports) {
    if (changes.length === 0) continue;
    
    lines.push(`## 🔌 Connector: \`${connector}\`\n`);

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
      if (change.type === "modified" && change.path && change.path.includes("auth"))
        summary.push(`🔐 Auth change`);
      if (change.type === "modified" && change.path && change.path.includes("outputFields"))
        summary.push(`📦 Output structure changed`);
    }

    lines.push(`### 🧾 Summary of Changes`);
    for (const item of [...new Set(summary)]) {
      lines.push(`- ${item}`);
    }
    lines.push('');

    // Group changes by category
    for (const [category, catChanges] of Object.entries(categoryMap)) {
      const catTitle = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`### 📂 ${catTitle} Changes`);

      for (const change of catChanges) {
        const emoji = getChangeEmoji(change.type, change.priority);
        
        if (change.type === "file-added") {
          lines.push(`${emoji} New file: \`${change.file}\``);
        } else if (change.type === "file-removed") {
          lines.push(`${emoji} Removed file: \`${change.file}\``);
        } else if (change.type === "folder-added") {
          lines.push(`${emoji} New folder added: \`${change.folder}/\``);
        } else if (change.type === "folder-removed") {
          lines.push(`${emoji} Folder removed: \`${change.folder}/\``);
        } else if (change.type === "added") {
          lines.push(`${emoji} Added \`${change.path}\` with value \`${formatValue(change.newVal)}\``);
        } else if (change.type === "removed") {
          lines.push(`${emoji} Removed \`${change.path}\` (was \`${formatValue(change.oldVal)}\`)`);
        } else if (change.type === "modified") {
          lines.push(`${emoji} Changed \`${change.path}\`: \`${formatValue(change.oldVal)}\` → \`${formatValue(change.newVal)}\``);
        }
      }
      
      lines.push('');
    }
  }

  fs.writeFileSync(outputPath, lines.join("\n"), 'utf-8');
}

module.exports = { generateMarkdownReport };
EOF

# Create JSON report generator
cat > src/report-generators/json-report.js << 'EOF'
/**
 * JSON data report generator
 */

const fs = require('fs');

/**
 * Generate JSON report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write JSON file
 */
async function generateJSONReport(reports, outputPath) {
  // Create a formatted JSON string
  const jsonContent = JSON.stringify(reports, null, 2);
  
  // Write the JSON file
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
}

module.exports = { generateJSONReport };
EOF

# Create HTML template
cat > templates/html-template.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Advanced Functional Change Report</title>
  <style>
    :root {
      --color-bg: #ffffff;
      --color-text: #333333;
      --color-primary: #0366d6;
      --color-secondary: #6c757d;
      --color-success: #28a745;
      --color-danger: #dc3545;
      --color-warning: #ffc107;
      --color-info: #17a2b8;
      --color-light: #f8f9fa;
      --color-dark: #343a40;
      --color-p0: #dc3545;
      --color-p1: #ffc107;
      --color-p2: #28a745;
      --color-border: #e1e4e8;
      --color-hover: #f6f8fa;
      --color-code-bg: #f6f8fa;
      --font-mono: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      --shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
    }
    
    [data-theme="dark"] {
      --color-bg: #0d1117;
      --color-text: #c9d1d9;
      --color-primary: #58a6ff;
      --color-secondary: #8b949e;
      --color-success: #3fb950;
      --color-danger: #f85149;
      --color-warning: #d29922;
      --color-info: #58a6ff;
      --color-light: #161b22;
      --color-dark: #c9d1d9;
      --color-p0: #f85149;
      --color-p1: #d29922;
      --color-p2: #3fb950;
      --color-border: #30363d;
      --color-hover: #161b22;
      --color-code-bg: #161b22;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text);
      background-color: var(--color-bg);
      margin: 0;
      padding: 20px;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    /* Layout */
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 10px;
    }
    
    .controls {
      position: sticky;
      top: 0;
      background-color: var(--color-bg);
      z-index: 100;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 20px;
    }
    
    .filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    /* Typography */
    h1 {
      font-size: 24px;
      margin-top: 0;
    }
    
    h2 {
      font-size: 20px;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--color-border);
    }
    
    h3 {
      font-size: 16px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    
    h4 {
      font-size: 14px;
      margin-top: 15px;
      margin-bottom: 10px;
    }
    
    a {
      color: var(--color-primary);
      text-decoration: none;
    }