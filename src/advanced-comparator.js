const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const config = require('./config-manager');
const logger = require('./logger');

class AdvancedComparator {
  constructor() {
    this.SIGNIFICANT_FILE_TYPES = ['.json'];
    this.MAX_DEPTH = config.get('maxComparisonDepth', 5);
  }

  async compareConnectors(prevPath, currPath) {
    logger.info('Starting connector comparison', { prevPath, currPath });
    const timer = logger.track('Connector Comparison');

    try {
      this.validatePaths(prevPath, currPath);
      
      const prevConnectors = await this.listConnectors(prevPath);
      const currConnectors = await this.listConnectors(currPath);
      
      const allConnectors = new Set([...prevConnectors, ...currConnectors]);
      const results = [];

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

  async compareConnector(prevConnectorPath, currConnectorPath) {
    const changes = [];
    const folders = config.get('comparableFolders', ['actions', 'auth', 'events', 'metadata']);

    for (const folder of folders) {
      const prevFolderPath = path.join(prevConnectorPath, folder);
      const currFolderPath = path.join(currConnectorPath, folder);

      try {
        const folderChanges = await this.compareFolderContents(
          prevFolderPath, 
          currFolderPath, 
          folder
        );
        
        changes.push(...folderChanges);
      } catch (folderError) {
        logger.warn(`Skipping folder ${folder} due to error`, folderError);
      }
    }

    return changes;
  }

  async compareFolderContents(prevPath, currPath, category) {
    const changes = [];
    const prevFiles = await this.listRelevantFiles(prevPath);
    const currFiles = await this.listRelevantFiles(currPath);

    const allFiles = new Set([...prevFiles, ...currFiles]);

    for (const file of allFiles) {
      const prevFilePath = path.join(prevPath, file);
      const currFilePath = path.join(currPath, file);

      const changeDetails = await this.compareFiles(
        prevFilePath, 
        currFilePath, 
        category
      );

      if (changeDetails) {
        changes.push(changeDetails);
      }
    }

    return changes;
  }

  async compareFiles(prevPath, currPath, category) {
    try {
      const prevExists = await this.fileExists(prevPath);
      const currExists = await this.fileExists(currPath);

      if (!prevExists && currExists) {
        return this.createFileAddedChange(currPath, category);
      }

      if (prevExists && !currExists) {
        return this.createFileRemovedChange(prevPath, category);
      }

      if (prevExists && currExists) {
        return this.compareFileContents(prevPath, currPath, category);
      }
    } catch (error) {
      logger.error(`File comparison error: ${prevPath} vs ${currPath}`, error);
    }

    return null;
  }

  // Helper methods (validatePaths, listConnectors, etc.) would be implemented here...

  validatePaths(prevPath, currPath) {
    // Use fs.existsSync instead of promises method
    if (!fs.existsSync(prevPath) || !fs.existsSync(currPath)) {
      throw new Error('Invalid connector paths');
    }
  }

  async listConnectors(basePath) {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      return entries
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    } catch (error) {
      logger.error('Failed to list connectors', error);
      return [];
    }
  }

  async listRelevantFiles(dirPath) {
    try {
      if (!await this.fileExists(dirPath)) return [];

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => 
          entry.isFile() && 
          this.SIGNIFICANT_FILE_TYPES.some(type => entry.name.endsWith(type))
        )
        .map(entry => entry.name);
    } catch (error) {
      logger.warn(`Could not list files in ${dirPath}`, error);
      return [];
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Additional specialized comparison methods would be added based on specific needs
}

module.exports = new AdvancedComparator();