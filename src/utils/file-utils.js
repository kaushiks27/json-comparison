/**
 * File utility functions
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * Load and parse JSON file safely
 * @param {string} filepath - Path to JSON file
 * @returns {Object|null} - Parsed JSON or null if error
 */
async function loadJSON(filepath) {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    logger.error(`Error parsing ${filepath}: ${e.message}`);
    return null;
  }
}

/**
 * Recursively collect all .json files in a given folder
 * @param {string} basePath - Base directory path
 * @returns {Object} - Object mapping filenames to parsed JSON content
 */
async function collectJSONFiles(basePath) {
  try {
    const exists = await pathExists(basePath);
    if (!exists) return {};
    
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const jsonFiles = {};

    for (const entry of entries) {
      const entryPath = path.join(basePath, entry.name);
      if (entry.isFile() && entry.name.endsWith(".json")) {
        jsonFiles[entry.name] = await loadJSON(entryPath);
      }
    }

    return jsonFiles;
  } catch (error) {
    logger.error(`Error collecting JSON files from ${basePath}`, error);
    return {};
  }
}

/**
 * Check if a path exists
 * @param {string} filepath - Path to check
 * @returns {Promise<boolean>} - True if exists
 */
async function pathExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format JSON value for display (with truncation for large values)
 * @param {any} value - Value to format
 * @param {number} truncateLength - Length at which to truncate
 * @returns {string} - Formatted value
 */
function formatValue(value, truncateLength = 80) {
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
  
  if (formatted.length > truncateLength) {
    return formatted.substring(0, truncateLength - 3) + '...';
  }
  
  return formatted;
}

module.exports = {
  loadJSON,
  collectJSONFiles,
  pathExists,
  formatValue
};