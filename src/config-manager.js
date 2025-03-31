const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configPath = path.join(__dirname, 'config.json')) {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      // Default configuration with fallback
      const defaultConfig = {
        maxComparisonDepth: 5,
        strictValidation: true,
        reportFormats: ['html', 'markdown', 'json'],
        ignoredFolders: ['meta', '.git', 'node_modules'],
        performanceLogging: false,
        logLevel: 'info',
        connectorSources: {
          previous: path.join(__dirname, '..', 'connectors', 'previous'),
          current: path.join(__dirname, '..', 'connectors', 'current')
        }
      };

      // Check if custom config exists
      if (fs.existsSync(this.configPath)) {
        const customConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return { ...defaultConfig, ...customConfig };
      }

      return defaultConfig;
    } catch (error) {
      console.error('Error loading configuration:', error);
      return defaultConfig;
    }
  }

  get(key, defaultValue = undefined) {
    return this.config[key] ?? defaultValue;
  }

  validate() {
    const validationRules = {
      maxComparisonDepth: (val) => typeof val === 'number' && val > 0,
      strictValidation: (val) => typeof val === 'boolean',
      reportFormats: (val) => Array.isArray(val) && val.length > 0
    };

    const errors = Object.entries(validationRules)
      .filter(([key, validate]) => !validate(this.config[key]))
      .map(([key]) => `Invalid configuration for ${key}`);

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
}

module.exports = new ConfigManager();