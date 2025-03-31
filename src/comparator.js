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
