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
