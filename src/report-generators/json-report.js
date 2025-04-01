/**
 * JSON report generator
 */

const fs = require('fs').promises;
const logger = require('../logger');

/**
 * Generate JSON report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write JSON file
 */
async function generateJSONReport(reports, outputPath) {
  try {
    logger.info('Generating JSON report');
    
    // Create a formatted JSON string
    // Ensure the data is properly sanitized for JSON output
    const jsonContent = JSON.stringify(sanitizeForJson(reports), null, 2);
    
    // Write the JSON file
    await fs.writeFile(outputPath, jsonContent, 'utf-8');
    
    logger.info('JSON report generated successfully', { path: outputPath });
  } catch (error) {
    logger.error('Failed to generate JSON report', error);
    throw error;
  }
}

/**
 * Sanitize data for JSON output
 * This helps prevent issues with circular references and non-serializable values
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
function sanitizeForJson(data) {
  const seen = new WeakSet();
  
  return JSON.parse(JSON.stringify(data, (key, value) => {
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    
    // Handle non-serializable values
    if (value instanceof Error) {
      return {
        error: value.message,
        stack: value.stack
      };
    }
    
    if (typeof value === 'function') {
      return '[Function]';
    }
    
    return value;
  }));
}

module.exports = { generateJSONReport };