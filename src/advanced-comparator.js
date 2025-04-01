/**
 * Advanced JSON Functional Change Detection
 * File comparison and change detection logic
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('./config-manager');
const logger = require('./logger');
const { loadJSON } = require('./utils/file-utils');

class AdvancedComparator {
  constructor() {
    this.SIGNIFICANT_FILE_TYPES = ['.json'];
    this.MAX_DEPTH = config.get('maxComparisonDepth', 5);
  }

  /**
   * Compare two connector directories and detect changes
   * @param {string} prevPath - Path to previous connector version
   * @param {string} currPath - Path to current connector version
   * @returns {Array} - Array of connector comparison results
   */
  async compareConnectors(prevPath, currPath) {
    logger.info('Starting connector comparison', { prevPath, currPath });
    const timer = logger.track('Connector Comparison');

    try {
      // Validate paths
      await this.validatePaths(prevPath, currPath);
      
      // Get connector directories
      const prevConnectors = await this.listConnectors(prevPath);
      const currConnectors = await this.listConnectors(currPath);
      
      // Combine unique connector names
      const allConnectors = [...new Set([...prevConnectors, ...currConnectors])];
      const results = [];

      // Compare each connector
      for (const connector of allConnectors) {
        try {
          const comparisonResult = await this.compareConnector(
            path.join(prevPath, connector), 
            path.join(currPath, connector)
          );
          
          results.push({
            connector,
            changes: comparisonResult
          });
        } catch (connectorError) {
          logger.error(`Failed to process connector ${connector}`, connectorError);
          results.push({
            connector,
            changes: [],
            processingError: connectorError.message
          });
        }
      }

      const duration = timer.end();
      logger.info('Connector comparison complete', { 
        totalConnectors: results.length,
        duration: `${duration}ms`
      });

      return results;
    } catch (error) {
      logger.error('Connector comparison failed', error);
      throw error;
    }
  }

  /**
   * Compare a single connector between versions
   * @param {string} prevConnectorPath - Path to previous connector version
   * @param {string} currConnectorPath - Path to current connector version 
   * @returns {Array} - Array of changes
   */
  async compareConnector(prevConnectorPath, currConnectorPath) {
    const changes = [];
    const folders = ['actions', 'auth', 'events', 'meta', 'metadata'];

    // Check if folder exists
    const prevExists = await this.pathExists(prevConnectorPath);
    const currExists = await this.pathExists(currConnectorPath);

    // Handle added/removed connectors
    if (!prevExists && currExists) {
      const folderChanges = await this.scanAllFiles(currConnectorPath);
      folderChanges.forEach(change => change.type = 'file-added');
      changes.push(...folderChanges);
      return changes;
    }

    if (prevExists && !currExists) {
      const folderChanges = await this.scanAllFiles(prevConnectorPath);
      folderChanges.forEach(change => change.type = 'file-removed');
      changes.push(...folderChanges);
      return changes;
    }

    // Compare each folder
    for (const folder of folders) {
      const prevFolderPath = path.join(prevConnectorPath, folder);
      const currFolderPath = path.join(currConnectorPath, folder);

      try {
        // Check folder existence
        const prevFolderExists = await this.pathExists(prevFolderPath);
        const currFolderExists = await this.pathExists(currFolderPath);

        // Handle added/removed folders
        if (!prevFolderExists && currFolderExists) {
          changes.push({
            type: 'folder-added',
            folder: folder,
            category: folder
          });
          
          const folderChanges = await this.scanAllFiles(currFolderPath);
          folderChanges.forEach(change => {
            change.type = 'file-added';
            change.category = folder;
          });
          changes.push(...folderChanges);
          continue;
        }

        if (prevFolderExists && !currFolderExists) {
          changes.push({
            type: 'folder-removed',
            folder: folder,
            category: folder
          });
          
          const folderChanges = await this.scanAllFiles(prevFolderPath);
          folderChanges.forEach(change => {
            change.type = 'file-removed';
            change.category = folder;
          });
          changes.push(...folderChanges);
          continue;
        }

        // If both folders exist, compare their contents
        if (prevFolderExists && currFolderExists) {
          const folderChanges = await this.compareFolderContents(
            prevFolderPath, 
            currFolderPath, 
            folder
          );
          
          changes.push(...folderChanges);
        }
      } catch (folderError) {
        logger.warn(`Error processing folder ${folder}`, folderError);
      }
    }

    return changes;
  }

  /**
   * Scan all files in a folder recursively
   * @param {string} dirPath - Path to scan
   * @returns {Array} - Array of file info
   */
  async scanAllFiles(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanAllFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && this.SIGNIFICANT_FILE_TYPES.some(ext => entry.name.endsWith(ext))) {
          files.push({
            file: entry.name,
            path: fullPath
          });
        }
      }
    } catch (error) {
      logger.warn(`Error scanning directory ${dirPath}`, error);
    }
    
    return files;
  }

  /**
   * Compare contents of two folders
   * @param {string} prevPath - Path to previous folder
   * @param {string} currPath - Path to current folder
   * @param {string} category - Category name for changes
   * @returns {Array} - Array of changes
   */
  async compareFolderContents(prevPath, currPath, category) {
    const changes = [];
    
    try {
      // List JSON files in both directories
      const prevFiles = await this.listJsonFiles(prevPath);
      const currFiles = await this.listJsonFiles(currPath);
      
      // Find all unique filenames
      const allFiles = [...new Set([...prevFiles, ...currFiles])];
      
      // Compare each file
      for (const file of allFiles) {
        const prevFilePath = path.join(prevPath, file);
        const currFilePath = path.join(currPath, file);
        
        try {
          const fileChanges = await this.compareJsonFiles(
            prevFilePath,
            currFilePath,
            category
          );
          
          if (fileChanges && fileChanges.length > 0) {
            changes.push(...fileChanges);
          }
        } catch (fileError) {
          logger.warn(`Error comparing files: ${prevFilePath} vs ${currFilePath}`, fileError);
        }
      }
    } catch (error) {
      logger.warn(`Error comparing folder contents: ${prevPath} vs ${currPath}`, error);
    }
    
    return changes;
  }

  /**
   * Compare two JSON files
   * @param {string} prevPath - Path to previous file
   * @param {string} currPath - Path to current file
   * @param {string} category - Category for changes
   * @returns {Array} - Array of changes
   */
  async compareJsonFiles(prevPath, currPath, category) {
    const changes = [];
    const prevExists = await this.pathExists(prevPath);
    const currExists = await this.pathExists(currPath);
    const fileName = path.basename(prevExists ? prevPath : currPath);
    
    // Handle added/removed files
    if (!prevExists && currExists) {
      changes.push({
        type: 'file-added',
        file: fileName,
        category: category
      });
      return changes;
    }
    
    if (prevExists && !currExists) {
      changes.push({
        type: 'file-removed',
        file: fileName,
        category: category
      });
      return changes;
    }
    
    // Compare file contents if both exist
    if (prevExists && currExists) {
      const prevData = await loadJSON(prevPath);
      const currData = await loadJSON(currPath);
      
      if (!prevData || !currData) {
        logger.warn(`Error loading JSON content: ${prevPath} or ${currPath}`);
        return changes;
      }
      
      // Find differences
      const objectDiff = this.compareObjects(prevData, currData, '', category);
      changes.push(...objectDiff);
    }
    
    return changes;
  }

  /**
   * Compare two objects recursively
   * @param {Object} prev - Previous object
   * @param {Object} curr - Current object
   * @param {string} basePath - Base path for nested properties
   * @param {string} category - Category for changes
   * @returns {Array} - Array of changes
   */
  compareObjects(prev, curr, basePath = '', category) {
    const changes = [];
    const allKeys = [...new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})])];
    
    // Compare each key
    for (const key of allKeys) {
      const currentPath = basePath ? `${basePath}.${key}` : key;
      const prevHasKey = prev && Object.prototype.hasOwnProperty.call(prev, key);
      const currHasKey = curr && Object.prototype.hasOwnProperty.call(curr, key);
      
      // Key added
      if (!prevHasKey && currHasKey) {
        changes.push({
          type: 'added',
          path: currentPath,
          newVal: curr[key],
          category: category
        });
        continue;
      }
      
      // Key removed
      if (prevHasKey && !currHasKey) {
        changes.push({
          type: 'removed',
          path: currentPath,
          oldVal: prev[key],
          category: category
        });
        continue;
      }
      
      // Both have key, check if values differ
      if (prevHasKey && currHasKey) {
        const prevVal = prev[key];
        const currVal = curr[key];
        
        // Different types
        if (typeof prevVal !== typeof currVal) {
          changes.push({
            type: 'modified',
            path: currentPath,
            oldVal: prevVal,
            newVal: currVal,
            category: category
          });
          continue;
        }
        
        // Both are objects, recurse
        if (typeof prevVal === 'object' && prevVal !== null && 
            typeof currVal === 'object' && currVal !== null &&
            !Array.isArray(prevVal) && !Array.isArray(currVal)) {
          
          const nestedChanges = this.compareObjects(prevVal, currVal, currentPath, category);
          changes.push(...nestedChanges);
          continue;
        }
        
        // Arrays require special handling
        if (Array.isArray(prevVal) && Array.isArray(currVal)) {
          // Check if arrays are different
          if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
            changes.push({
              type: 'modified',
              path: currentPath,
              oldVal: prevVal,
              newVal: currVal,
              category: category
            });
          }
          continue;
        }
        
        // Compare primitive values
        if (prevVal !== currVal) {
          changes.push({
            type: 'modified',
            path: currentPath,
            oldVal: prevVal,
            newVal: currVal,
            category: category
          });
        }
      }
    }
    
    return changes;
  }

  /**
   * List JSON files in a directory
   * @param {string} dirPath - Directory path
   * @returns {Array} - Array of filenames
   */
  async listJsonFiles(dirPath) {
    try {
      if (!await this.pathExists(dirPath)) {
        return [];
      }
      
      const entries = await fs.readdir(dirPath);
      return entries.filter(entry => this.SIGNIFICANT_FILE_TYPES.some(ext => entry.endsWith(ext)));
    } catch (error) {
      logger.warn(`Error listing JSON files in ${dirPath}`, error);
      return [];
    }
  }

  /**
   * Check if a path exists
   * @param {string} filePath - Path to check
   * @returns {boolean} - True if exists
   */
  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate comparison paths
   * @param {string} prevPath - Previous path
   * @param {string} currPath - Current path
   */
  async validatePaths(prevPath, currPath) {
    const prevExists = await this.pathExists(prevPath);
    const currExists = await this.pathExists(currPath);

    if (!prevExists && !currExists) {
      throw new Error(`Both connector paths do not exist: ${prevPath} and ${currPath}`);
    }
    
    if (!prevExists) {
      logger.warn(`Previous connector path does not exist: ${prevPath}`);
    }
    
    if (!currExists) {
      logger.warn(`Current connector path does not exist: ${currPath}`);
    }
  }

  /**
   * List connector directories
   * @param {string} basePath - Base path
   * @returns {Array} - Array of connector names
   */
  async listConnectors(basePath) {
    try {
      const exists = await this.pathExists(basePath);
      if (!exists) {
        return [];
      }
      
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      logger.error(`Failed to list connectors at ${basePath}`, error);
      return [];
    }
  }
}

module.exports = AdvancedComparator;