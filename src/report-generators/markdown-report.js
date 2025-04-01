/**
 * Markdown report generator
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * Generate Markdown report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write Markdown file
 */
async function generateMarkdownReport(reports, outputPath) {
  try {
    logger.info('Generating Markdown report');
    
    // Generate stats
    const stats = generateReportStats(reports);
    
    // Start building Markdown content
    const lines = ["# 📋 Functional Change Report\n"];
    
    // Add priority counts summary
    lines.push(`> **Change Summary:** ${stats.priority.P0} Critical, ${stats.priority.P1} Major, ${stats.priority.P2} Minor changes\n`);
    
    // Generate executive summary
    const executiveSummary = generateExecutiveSummary(reports);
    if (executiveSummary.length > 0) {
      lines.push(...executiveSummary);
    }
    
    // Generate detailed report
    const detailedReport = generateDetailedReport(reports);
    lines.push(...detailedReport);
    
    // Write to file
    await fs.writeFile(outputPath, lines.join('\n'), 'utf-8');
    
    logger.info('Markdown report generated successfully', { path: outputPath });
  } catch (error) {
    logger.error('Failed to generate Markdown report', error);
    throw error;
  }
}

/**
 * Generate statistics from report data
 * @param {Array} reports - Processed reports
 * @returns {Object} - Stats object
 */
function generateReportStats(reports) {
  const stats = {
    priority: { P0: 0, P1: 0, P2: 0 },
    changeTypes: {},
    categories: {}
  };
  
  reports.forEach(connector => {
    connector.changes.forEach(change => {
      // Count by priority
      stats.priority[change.priority] = (stats.priority[change.priority] || 0) + 1;
      
      // Count by change type
      stats.changeTypes[change.type] = (stats.changeTypes[change.type] || 0) + 1;
      
      // Count by category
      const category = change.category || 'other';
      if (!stats.categories[category]) {
        stats.categories[category] = { total: 0, P0: 0, P1: 0, P2: 0 };
      }
      stats.categories[category].total++;
      stats.categories[category][change.priority]++;
    });
  });
  
  return stats;
}

/**
 * Generate executive summary section
 * @param {Array} reports - Connector reports
 * @returns {Array} - Lines for executive summary
 */
function generateExecutiveSummary(reports) {
  const lines = [];
  
  // Collect critical and major changes
  const criticalChanges = [];
  for (const { connector, changes } of reports) {
    if (!changes) continue;
    
    for (const change of changes) {
      if (change.priority === 'P0' || change.priority === 'P1') {
        criticalChanges.push({ connector, ...change });
      }
    }
  }
  
  if (criticalChanges.length === 0) {
    return [];
  }
  
  lines.push('## 🚨 Executive Summary\n');
  
  // Group by connector
  const criticalByConnector = {};
  for (const change of criticalChanges) {
    if (!criticalByConnector[change.connector]) {
      criticalByConnector[change.connector] = [];
    }
    criticalByConnector[change.connector].push(change);
  }
  
  // Generate summary by connector
  for (const [connector, changes] of Object.entries(criticalByConnector)) {
    lines.push(`### ${connector}\n`);
    
    for (const change of changes) {
      const emoji = getChangeEmoji(change.type);
      const priority = change.priority === 'P0' ? '🔴' : '🟠';
      
      let description;
      if (change.type === 'file-added') {
        description = `Added file: \`${change.file}\``;
      } else if (change.type === 'file-removed') {
        description = `Removed file: \`${change.file}\``;
      } else if (change.type === 'folder-added') {
        description = `Added folder: \`${change.folder}/\``;
      } else if (change.type === 'folder-removed') {
        description = `Removed folder: \`${change.folder}/\``;
      } else if (change.type === 'added') {
        description = `Added \`${change.path}\``;
        if (change.newVal !== undefined) {
          description += ` with value \`${formatValue(change.newVal)}\``;
        }
      } else if (change.type === 'removed') {
        description = `Removed \`${change.path}\``;
        if (change.oldVal !== undefined) {
          description += ` (was \`${formatValue(change.oldVal)}\`)`;
        }
      } else if (change.type === 'modified') {
        description = `Changed \`${change.path}\``;
        if (change.oldVal !== undefined && change.newVal !== undefined) {
          description += `: \`${formatValue(change.oldVal)}\` → \`${formatValue(change.newVal)}\``;
        }
      }
      
      lines.push(`- ${priority} ${emoji} ${description}`);
    }
    
    lines.push('');
  }
  
  return lines;
}

/**
 * Generate detailed report section
 * @param {Array} reports - Connector reports
 * @returns {Array} - Lines for detailed report
 */
function generateDetailedReport(reports) {
  const lines = [];
  
  for (const { connector, changes } of reports) {
    if (!changes || changes.length === 0) continue;
    
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
      if (change.type === "folder-added") summary.push(`📁 New folder: ${change.folder}`);
      if (change.type === "folder-removed") summary.push(`📁 Removed folder: ${change.folder}`);
      if (change.type === "modified" && change.path && change.path.includes("auth")) summary.push(`🔐 Auth change`);
      if (change.type === "modified" && change.path && change.path.includes("outputFields")) summary.push(`📦 Output structure changed`);
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
        const emoji = getChangeEmoji(change.type);
        
        if (change.type === "file-added") {
          lines.push(`${emoji} New file: \`${change.file}\``);
        } else if (change.type === "file-removed") {
          lines.push(`${emoji} Removed file: \`${change.file}\``);
        } else if (change.type === "folder-added") {
          lines.push(`${emoji} New folder added: \`${change.folder}/\``);
        } else if (change.type === "folder-removed") {
          lines.push(`${emoji} Folder removed: \`${change.folder}/\``);
        } else if (change.type === "added") {
          let line = `${emoji} Added \`${change.path}\``;
          if (change.newVal !== undefined) {
            line += ` with value \`${formatValue(change.newVal)}\``;
          }
          lines.push(line);
        } else if (change.type === "removed") {
          let line = `${emoji} Removed \`${change.path}\``;
          if (change.oldVal !== undefined) {
            line += ` (was \`${formatValue(change.oldVal)}\`)`;
          }
          lines.push(line);
        } else if (change.type === "modified") {
          let line = `${emoji} Changed \`${change.path}\``;
          if (change.oldVal !== undefined && change.newVal !== undefined) {
            line += `: \`${formatValue(change.oldVal)}\` → \`${formatValue(change.newVal)}\``;
          }
          lines.push(line);
        }
      }
      
      lines.push('');
    }
  }
  
  return lines;
}

/**
 * Get emoji for change type
 * @param {string} type - Change type
 * @returns {string} - Emoji for change type
 */
function getChangeEmoji(type) {
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
      return 'ℹ️';
  }
}

/**
 * Format value for display
 * @param {any} value - Value to format
 * @param {number} maxLength - Maximum length
 * @returns {string} - Formatted value
 */
function formatValue(value, maxLength = 60) {
  if (value === undefined || value === null) {
    return String(value);
  }
  
  let formatted;
  try {
    if (typeof value === 'object') {
      formatted = JSON.stringify(value);
    } else {
      formatted = String(value);
    }
  } catch (error) {
    return '[Complex Object]';
  }
  
  if (formatted.length > maxLength) {
    return formatted.substring(0, maxLength - 3) + '...';
  }
  
  return formatted;
}

module.exports = { generateMarkdownReport };