/**
 * Data loading script for report UI
 */

class DataLoader {
  constructor() {
    this.reportData = null;
    this.statsData = null;
    this.isLoaded = false;
    this.loadingError = null;
  }

  /**
   * Initialize data loader
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      // Parse report data from template
      this.parseTemplateData();
      
      // If no data in template, try to fetch from server
      if (!this.isLoaded) {
        await this.fetchReportData();
      }
      
      return this.isLoaded;
    } catch (error) {
      console.error('Error initializing data loader:', error);
      this.loadingError = error.message;
      return false;
    }
  }

  /**
   * Parse report data from template
   */
  parseTemplateData() {
    try {
      // The template should have replaced these placeholders with actual data
      const reportDataStr = document.getElementById('report-data-json')?.textContent;
      const statsDataStr = document.getElementById('stats-data-json')?.textContent;
      
      if (reportDataStr) {
        this.reportData = JSON.parse(reportDataStr);
        this.isLoaded = true;
      }
      
      if (statsDataStr) {
        this.statsData = JSON.parse(statsDataStr);
      } else if (this.reportData) {
        // Generate stats from report data if not provided
        this.statsData = this.generateStats(this.reportData);
      }
    } catch (error) {
      console.warn('Error parsing template data:', error);
    }
  }

  /**
   * Fetch report data from server
   * @returns {Promise<boolean>} - Success status
   */
  async fetchReportData() {
    try {
      // Try to fetch JSON data
      const response = await fetch('functional-change-data.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch report data: ${response.status} ${response.statusText}`);
      }
      
      this.reportData = await response.json();
      this.statsData = this.generateStats(this.reportData);
      this.isLoaded = true;
      
      return true;
    } catch (error) {
      console.error('Error fetching report data:', error);
      this.loadingError = error.message;
      return false;
    }
  }

  /**
   * Generate statistics from report data
   * @param {Array} reports - Connector reports
   * @returns {Object} - Statistics object
   */
  generateStats(reports) {
    const stats = {
      priority: { P0: 0, P1: 0, P2: 0 },
      changeTypes: {},
      categories: {}
    };
    
    if (!reports || !Array.isArray(reports)) {
      return stats;
    }
    
    reports.forEach(connector => {
      if (!connector.changes || !Array.isArray(connector.changes)) {
        return;
      }
      
      connector.changes.forEach(change => {
        // Count by priority
        const priority = change.priority || 'P2';
        stats.priority[priority] = (stats.priority[priority] || 0) + 1;
        
        // Count by change type
        const type = change.type || 'unknown';
        stats.changeTypes[type] = (stats.changeTypes[type] || 0) + 1;
        
        // Count by category
        const category = change.category || 'other';
        if (!stats.categories[category]) {
          stats.categories[category] = { total: 0, P0: 0, P1: 0, P2: 0 };
        }
        stats.categories[category].total++;
        stats.categories[category][priority]++;
      });
    });
    
    return stats;
  }

  /**
   * Get report data
   * @returns {Array} - Report data
   */
  getReportData() {
    return this.reportData;
  }

  /**
   * Get statistics data
   * @returns {Object} - Statistics data
   */
  getStatsData() {
    return this.statsData;
  }

  /**
   * Check if data is loaded
   * @returns {boolean} - True if data is loaded
   */
  isDataLoaded() {
    return this.isLoaded;
  }

  /**
   * Get loading error message
   * @returns {string|null} - Error message
   */
  getError() {
    return this.loadingError;
  }
}

// Create global instance
window.dataLoader = new DataLoader();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const loaded = await window.dataLoader.initialize();
  
  if (loaded) {
    // Make data available globally
    window.reportData = window.dataLoader.getReportData();
    window.statsData = window.dataLoader.getStatsData();
    
    // Dispatch event for other scripts
    document.dispatchEvent(new CustomEvent('reportDataLoaded', {
      detail: {
        reportData: window.reportData,
        statsData: window.statsData
      }
    }));
  } else {
    // Display error message
    const errorMsg = window.dataLoader.getError() || 'Failed to load report data';
    
    const reportContent = document.getElementById('report-content');
    if (reportContent) {
      reportContent.innerHTML = `
        <div style="padding: 20px; border: 1px solid var(--color-danger); border-radius: 5px; background-color: rgba(220,53,69,0.1);">
          <h2>Error Loading Report Data</h2>
          <p>${errorMsg}</p>
          <p>Please check that the report files were generated correctly.</p>
        </div>
      `;
    }
  }
});
