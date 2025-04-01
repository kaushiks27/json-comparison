/**
 * Data loading script for report UI
 */

(function() {
  // Global data containers
  window.reportData = [];
  window.statsData = {
    priority: { P0: 0, P1: 0, P2: 0 },
    changeTypes: {},
    categories: {}
  };

  /**
   * Initialize data loader
   */
  function initializeDataLoader() {
    try {
      // Get data from embedded script tags
      const reportDataElement = document.getElementById('report-data');
      const statsDataElement = document.getElementById('stats-data');
      
      if (reportDataElement) {
        window.reportData = JSON.parse(reportDataElement.textContent);
        console.log('Report data loaded:', window.reportData.length, 'connectors');
      } else {
        console.error('Report data element not found');
      }
      
      if (statsDataElement) {
        window.statsData = JSON.parse(statsDataElement.textContent);
        console.log('Stats data loaded');
      } else if (window.reportData.length > 0) {
        // Generate stats from report data if stats element not found
        window.statsData = generateStats(window.reportData);
        console.log('Stats data generated from report data');
      } else {
        console.error('Stats data element not found and unable to generate stats');
      }
      
      // Dispatch event for other scripts
      document.dispatchEvent(new CustomEvent('reportDataLoaded', {
        detail: {
          reportData: window.reportData,
          statsData: window.statsData
        }
      }));
      
      // Initialize UI components
      initializeUI();
    } catch (error) {
      console.error('Error initializing data loader:', error);
      showErrorMessage(error.message);
    }
  }

  /**
   * Generate statistics from report data
   * @param {Array} reports - Connector reports
   * @returns {Object} - Statistics object
   */
  function generateStats(reports) {
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
   * Initialize UI components
   */
  function initializeUI() {
    // Set up filter state
    window.filterState = {
      priority: { P0: true, P1: true, P2: true },
      type: {
        added: true, removed: true, modified: true,
        'file-added': true, 'file-removed': true,
        'folder-added': true, 'folder-removed': true
      },
      category: {},
      search: ''
    };
    
    // Initialize categories from data
    const categories = {};
    window.reportData.forEach(connector => {
      if (!connector.changes) return;
      
      connector.changes.forEach(change => {
        if (change.category) {
          categories[change.category] = true;
          // Initialize filter state
          window.filterState.category[change.category] = true;
        }
      });
    });
    
    // Generate category filters
    const categoryFiltersElement = document.getElementById('category-filters');
    if (categoryFiltersElement) {
      let categoryHtml = '<strong>Category:</strong> ';
      
      Object.keys(categories).sort().forEach(category => {
        const id = `filter-${category}`;
        categoryHtml += `
          <input type="checkbox" id="${id}" class="filter-checkbox" checked data-category="${category}">
          <label for="${id}" class="filter-label">${category.charAt(0).toUpperCase() + category.slice(1)}</label>
        `;
      });
      
      categoryFiltersElement.innerHTML = categoryHtml;
    }
    
    // Generate stats summary
    if (typeof generateStatsSummary === 'function') {
      generateStatsSummary();
    }
    
    // Generate table of contents
    if (typeof generateTableOfContents === 'function') {
      generateTableOfContents();
    }
    
    // Generate executive summary
    if (typeof generateExecutiveSummary === 'function') {
      generateExecutiveSummary();
    }
    
    // Generate report content
    if (typeof generateReportContent === 'function') {
      generateReportContent();
    }
    
    // Setup event listeners
    setupFilterEventListeners();
    
    // Apply URL parameters if any
    if (typeof applyUrlParams === 'function') {
      applyUrlParams();
    }
  }

  /**
   * Set up filter event listeners
   */
  function setupFilterEventListeners() {
    // Priority filters
    document.querySelectorAll('[id^="filter-p"]').forEach(element => {
      element.addEventListener('change', function() {
        const priority = this.id.replace('filter-p', 'P');
        window.filterState.priority[priority] = this.checked;
        if (typeof applyFilters === 'function') applyFilters();
      });
    });
    
    // Type filters
    const typeFilters = {
      'filter-added': ['added', 'file-added', 'folder-added'],
      'filter-removed': ['removed', 'file-removed', 'folder-removed'],
      'filter-modified': ['modified']
    };
    
    Object.entries(typeFilters).forEach(([filterId, types]) => {
      const element = document.getElementById(filterId);
      if (element) {
        element.addEventListener('change', function() {
          types.forEach(type => {
            window.filterState.type[type] = this.checked;
          });
          if (typeof applyFilters === 'function') applyFilters();
        });
      }
    });
    
    // Category filters
    document.querySelectorAll('[id^="filter-"][data-category]').forEach(element => {
      element.addEventListener('change', function() {
        window.filterState.category[this.dataset.category] = this.checked;
        if (typeof applyFilters === 'function') applyFilters();
      });
    });
    
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        window.filterState.search = this.value.toLowerCase();
        if (typeof applyFilters === 'function') applyFilters();
      });
    }
    
    // Reset filters button
    const resetButton = document.getElementById('btn-reset-filters');
    if (resetButton) {
      resetButton.addEventListener('click', function() {
        if (typeof resetFilters === 'function') resetFilters();
      });
    }
    
    // Export buttons
    const exportButtons = {
      'btn-export-pdf': () => window.print(),
      'btn-export-html': exportHTML,
      'btn-export-markdown': () => window.location.href = 'functional-change-report.md',
      'btn-export-json': () => window.location.href = 'functional-change-data.json'
    };
    
    Object.entries(exportButtons).forEach(([buttonId, handler]) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener('click', handler);
      }
    });
  }

  /**
   * Export HTML report
   */
  function exportHTML() {
    try {
      const htmlContent = document.documentElement.outerHTML;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'functional-change-report.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting HTML:', error);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  function showErrorMessage(message) {
    const reportContent = document.getElementById('report-content');
    if (reportContent) {
      reportContent.innerHTML = `
        <div style="padding: 20px; border: 1px solid #dc3545; border-radius: 5px; background-color: rgba(220,53,69,0.1);">
          <h2>Error Loading Report Data</h2>
          <p>${message}</p>
          <p>Please check that the report files were generated correctly.</p>
        </div>
      `;
    }
  }

  // Initialize on DOM content loaded
  document.addEventListener('DOMContentLoaded', initializeDataLoader);
})(); 