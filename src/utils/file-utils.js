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
