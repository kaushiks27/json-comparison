/**
 * HTML report generator
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * Generate HTML report
 * @param {Array} reports - Array of connector reports
 * @param {string} outputPath - Path to write HTML file
 */
async function generateHTMLReport(reports, outputPath) {
  try {
    logger.info('Generating HTML report');
    
    // Read the HTML template
    const templatePath = path.join(process.cwd(), 'templates', 'html-template.html');
    let template = await fs.readFile(templatePath, 'utf-8');
    
    // Generate stats for the report
    const statsData = generateReportStats(reports);
    
    // Replace template placeholders with actual data
    template = template.replace('{{REPORT_DATA}}', JSON.stringify(reports, null, 2));
    template = template.replace('{{STATS_DATA}}', JSON.stringify(statsData, null, 2));
    
    // Add initialization script
    template = injectInitializationScript(template);
    
    // Write the HTML report
    a.href = url;
    a.download = 'functional-change-report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting HTML:', error);
    alert('Failed to export HTML. See console for details.');
  }
}

function exportMarkdown() {
  try {
    // Redirect to markdown file
    window.location.href = 'functional-change-report.md';
  } catch (error) {
    console.error('Error exporting Markdown:', error);
    alert('Failed to export Markdown. See console for details.');
  }
}

function exportJSON() {
  try {
    // Redirect to JSON file
    window.location.href = 'functional-change-data.json';
  } catch (error) {
    console.error('Error exporting JSON:', error);
    alert('Failed to export JSON. See console for details.');
  }
}
</script>`;
  
  return template;
}

module.exports = { generateHTMLReport };
wait fs.writeFile(outputPath, template, 'utf-8');
    
    logger.info('HTML report generated successfully', { path: outputPath });
  } catch (error) {
    logger.error('Failed to generate HTML report', error);
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
 * Inject initialization script into HTML template
 * @param {string} template - HTML template
 * @returns {string} - Template with initialization script
 */
function injectInitializationScript(template) {
  const initScript = `
<script>
// Initialize report data
const reportData = JSON.parse('{{REPORT_DATA}}');
const statsData = JSON.parse('{{STATS_DATA}}');

// Initialize UI state
const categories = {};
const filterState = {
  priority: {
    P0: true,
    P1: true,
    P2: true
  },
  type: {
    added: true,
    removed: true,
    modified: true,
    'file-added': true,
    'file-removed': true,
    'folder-added': true,
    'folder-removed': true
  },
  category: {},
  search: ''
};

// Get icon for change type
function getChangeEmoji(type, priority) {
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
      // Use priority-based emoji for other cases
      if (priority === 'P0') return '🚨';
      if (priority === 'P1') return '⚠️';
      return 'ℹ️';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Priority filters
  const p0Filter = document.getElementById('filter-p0');
  const p1Filter = document.getElementById('filter-p1');
  const p2Filter = document.getElementById('filter-p2');
  
  if (p0Filter) {
    p0Filter.addEventListener('change', function() {
      filterState.priority.P0 = this.checked;
      applyFilters();
      updateUrlParams();
    });
  }
  
  if (p1Filter) {
    p1Filter.addEventListener('change', function() {
      filterState.priority.P1 = this.checked;
      applyFilters();
      updateUrlParams();
    });
  }
  
  if (p2Filter) {
    p2Filter.addEventListener('change', function() {
      filterState.priority.P2 = this.checked;
      applyFilters();
      updateUrlParams();
    });
  }
  
  // Type filters
  const addedFilter = document.getElementById('filter-added');
  const removedFilter = document.getElementById('filter-removed');
  const modifiedFilter = document.getElementById('filter-modified');
  
  if (addedFilter) {
    addedFilter.addEventListener('change', function() {
      filterState.type.added = this.checked;
      filterState.type['file-added'] = this.checked;
      filterState.type['folder-added'] = this.checked;
      applyFilters();
      updateUrlParams();
    });
  }
  
  if (removedFilter) {
    removedFilter.addEventListener('change', function() {
      filterState.type.removed = this.checked;
      filterState.type['file-removed'] = this.checked;
      filterState.type['folder-removed'] = this.checked;
      applyFilters();
      updateUrlParams();
    });
  }
  
  if (modifiedFilter) {
    modifiedFilter.addEventListener('change', function() {
      filterState.type.modified = this.checked;
      applyFilters();
      updateUrlParams();
    });
  }
  
  // Category filters
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      filterState.category[this.dataset.category] = this.checked;
      applyFilters();
      updateUrlParams();
    });
  });
  
  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterState.search = this.value.toLowerCase();
      applyFilters();
      updateUrlParams();
    });
  }
  
  // Reset filters button
  const resetButton = document.getElementById('btn-reset-filters');
  if (resetButton) {
    resetButton.addEventListener('click', function() {
      resetFilters();
    });
  }
  
  // Export buttons
  const pdfButton = document.getElementById('btn-export-pdf');
  if (pdfButton) {
    pdfButton.addEventListener('click', function() {
      window.print();
    });
  }
  
  const htmlButton = document.getElementById('btn-export-html');
  if (htmlButton) {
    htmlButton.addEventListener('click', function() {
      exportHTML();
    });
  }
  
  const mdButton = document.getElementById('btn-export-md');
  if (mdButton) {
    mdButton.addEventListener('click', function() {
      exportMarkdown();
    });
  }
  
  const jsonButton = document.getElementById('btn-export-json');
  if (jsonButton) {
    jsonButton.addEventListener('click', function() {
      exportJSON();
    });
  }
}

// Setup back to top button
function setupBackToTop() {
  const backToTopButton = document.getElementById('back-to-top');
  if (!backToTopButton) return;
  
  // Show button when page is scrolled down
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  });
  
  // Scroll to top when button is clicked
  backToTopButton.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Export functions
function exportHTML() {
  try {
    // Create a standalone version of the current page
    const htmlContent = document.documentElement.outerHTML;
    
    // Create a blob and download link
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a
document.addEventListener('DOMContentLoaded', function() {
  try {
    if (!reportData || !Array.isArray(reportData)) {
      console.error('Invalid report data format');
      document.getElementById('report-content').innerHTML = '<p>Error: Invalid report data</p>';
      return;
    }
    
    // Setup category filters
    const categoryFilters = document.getElementById('category-filters');
    if (categoryFilters) {
      // Build category list
      for (const { changes } of reportData) {
        for (const change of changes) {
          if (change.category) {
            categories[change.category] = true;
            // Initialize filter state
            filterState.category[change.category] = true;
          }
        }
      }
      
      // Create filter checkboxes
      for (const category of Object.keys(categories).sort()) {
        const id = \`filter-\${category}\`;
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.className = 'filter-checkbox';
        input.checked = true;
        input.dataset.category = category;
        
        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'filter-label';
        label.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        
        categoryFilters.appendChild(input);
        categoryFilters.appendChild(label);
      }
    }
    
    // Generate stats summary
    generateStatsSummary();
    
    // Generate table of contents
    generateTableOfContents();
    
    // Generate executive summary
    generateExecutiveSummary();
    
    // Generate report content
    generateReportContent();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup back to top button
    setupBackToTop();
    
    // Apply URL parameters if any
    applyUrlParams();
  } catch (error) {
    console.error('Error initializing report:', error);
    document.getElementById('report-content').innerHTML = 
      '<p>Error initializing report. Please check console for details.</p>';
  }
});

// Apply filters to the report
function applyFilters() {
  const searchResults = document.getElementById('search-results');
  let matchCount = 0;
  let totalCount = 0;
  
  // Process each change item
  const changeItems = document.querySelectorAll('.change-item');
  changeItems.forEach(item => {
    const priority = item.dataset.priority;
    const type = item.dataset.type;
    const category = item.dataset.category;
    
    totalCount++;
    
    // Check if item matches all filters
    const matchesPriority = filterState.priority[priority];
    const matchesType = filterState.type[type];
    const matchesCategory = filterState.category[category] !== false; // Default to true if undefined
    
    // Check if item matches search
    const matchesSearch = filterState.search === '' || 
      item.textContent.toLowerCase().includes(filterState.search);
    
    const isVisible = matchesPriority && matchesType && matchesCategory && matchesSearch;
    
    // Show/hide item
    item.style.display = isVisible ? 'block' : 'none';
    
    if (isVisible) matchCount++;
  });
  
  // Update search results
  if (filterState.search !== '') {
    if (searchResults) {
      searchResults.textContent = \`Found \${matchCount} matches\`;
      searchResults.style.display = 'block';
    }
  } else if (searchResults) {
    searchResults.style.display = 'none';
  }
  
  // Update executive summary items
  const summaryItems = document.querySelectorAll('#executive-summary li');
  summaryItems.forEach(item => {
    const priority = item.dataset.priority;
    const type = item.dataset.type;
    const category = item.dataset.category;
    
    const matchesPriority = filterState.priority[priority];
    const matchesType = filterState.type[type];
    const matchesCategory = filterState.category[category] !== false;
    const matchesSearch = filterState.search === '' || 
      item.textContent.toLowerCase().includes(filterState.search);
    
    item.style.display = (matchesPriority && matchesType && matchesCategory && matchesSearch) ? 'list-item' : 'none';
  });
}

// Reset all filters
function resetFilters() {
  // Reset priority filters
  filterState.priority.P0 = true;
  filterState.priority.P1 = true;
  filterState.priority.P2 = true;
  
  const p0Filter = document.getElementById('filter-p0');
  const p1Filter = document.getElementById('filter-p1');
  const p2Filter = document.getElementById('filter-p2');
  
  if (p0Filter) p0Filter.checked = true;
  if (p1Filter) p1Filter.checked = true;
  if (p2Filter) p2Filter.checked = true;
  
  // Reset type filters
  filterState.type.added = true;
  filterState.type['file-added'] = true;
  filterState.type['folder-added'] = true;
  filterState.type.removed = true;
  filterState.type['file-removed'] = true;
  filterState.type['folder-removed'] = true;
  filterState.type.modified = true;
  
  const addedFilter = document.getElementById('filter-added');
  const removedFilter = document.getElementById('filter-removed');
  const modifiedFilter = document.getElementById('filter-modified');
  
  if (addedFilter) addedFilter.checked = true;
  if (removedFilter) removedFilter.checked = true;
  if (modifiedFilter) modifiedFilter.checked = true;
  
  // Reset category filters
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    checkbox.checked = true;
    filterState.category[checkbox.dataset.category] = true;
  });
  
  // Reset search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    filterState.search = '';
  }
  
  // Apply filters
  applyFilters();
  updateUrlParams();
}

// Update URL parameters to reflect current filter state
function updateUrlParams() {
  const params = new URLSearchParams();
  
  // Add priority params
  if (!filterState.priority.P0) params.append('p0', 'false');
  if (!filterState.priority.P1) params.append('p1', 'false');
  if (!filterState.priority.P2) params.append('p2', 'false');
  
  // Add type params
  if (!filterState.type.added) params.append('added', 'false');
  if (!filterState.type.removed) params.append('removed', 'false');
  if (!filterState.type.modified) params.append('modified', 'false');
  
  // Add category params
  for (const [category, enabled] of Object.entries(filterState.category)) {
    if (!enabled) params.append(\`cat_\${category}\`, 'false');
  }
  
  // Add search param
  if (filterState.search) params.append('search', filterState.search);
  
  // Update URL without reloading page
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  try {
    window.history.replaceState({}, '', newUrl);
  } catch (error) {
    console.warn('Failed to update URL parameters:', error);
  }
}

// Apply URL parameters
function applyUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    
    // Apply priority params
    if (params.get('p0') === 'false') {
      filterState.priority.P0 = false;
      const p0Filter = document.getElementById('filter-p0');
      if (p0Filter) p0Filter.checked = false;
    }
    
    if (params.get('p1') === 'false') {
      filterState.priority.P1 = false;
      const p1Filter = document.getElementById('filter-p1');
      if (p1Filter) p1Filter.checked = false;
    }
    
    if (params.get('p2') === 'false') {
      filterState.priority.P2 = false;
      const p2Filter = document.getElementById('filter-p2');
      if (p2Filter) p2Filter.checked = false;
    }
    
    // Apply type params
    if (params.get('added') === 'false') {
      filterState.type.added = false;
      filterState.type['file-added'] = false;
      filterState.type['folder-added'] = false;
      const addedFilter = document.getElementById('filter-added');
      if (addedFilter) addedFilter.checked = false;
    }
    
    if (params.get('removed') === 'false') {
      filterState.type.removed = false;
      filterState.type['file-removed'] = false;
      filterState.type['folder-removed'] = false;
      const removedFilter = document.getElementById('filter-removed');
      if (removedFilter) removedFilter.checked = false;
    }
    
    if (params.get('modified') === 'false') {
      filterState.type.modified = false;
      const modifiedFilter = document.getElementById('filter-modified');
      if (modifiedFilter) modifiedFilter.checked = false;
    }
    
    // Apply category params
    const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
    categoryCheckboxes.forEach(checkbox => {
      const category = checkbox.dataset.category;
      if (params.get(\`cat_\${category}\`) === 'false') {
        filterState.category[category] = false;
        checkbox.checked = false;
      }
    });
    
    // Apply search param
    const searchValue = params.get('search');
    if (searchValue) {
      filterState.search = searchValue;
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = searchValue;
    }
    
    // Apply filters
    applyFilters();
  } catch (error) {
    console.warn('Error applying URL parameters:', error);
  }
}