/**
 * Filtering functionality
 */

// Track current filter state
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
    const matchesCategory = filterState.category[category];
    
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
    searchResults.textContent = `Found ${matchCount} matches`;
    searchResults.style.display = 'block';
  } else {
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
    const matchesCategory = filterState.category[category];
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
  
  document.getElementById('filter-p0').checked = true;
  document.getElementById('filter-p1').checked = true;
  document.getElementById('filter-p2').checked = true;
  
  // Reset type filters
  filterState.type.added = true;
  filterState.type['file-added'] = true;
  filterState.type['folder-added'] = true;
  filterState.type.removed = true;
  filterState.type['file-removed'] = true;
  filterState.type['folder-removed'] = true;
  filterState.type.modified = true;
  
  document.getElementById('filter-added').checked = true;
  document.getElementById('filter-removed').checked = true;
  document.getElementById('filter-modified').checked = true;
  
  // Reset category filters
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    checkbox.checked = true;
    filterState.category[checkbox.dataset.category] = true;
  });
  
  // Reset search
  document.getElementById('search-input').value = '';
  filterState.search = '';
  
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
    if (!enabled) params.append(`cat_${category}`, 'false');
  }
  
  // Add search param
  if (filterState.search) params.append('search', filterState.search);
  
  // Update URL without reloading page
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', newUrl);
}

// Apply URL parameters
function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  
  // Apply priority params
  if (params.get('p0') === 'false') {
    filterState.priority.P0 = false;
    document.getElementById('filter-p0').checked = false;
  }
  
  if (params.get('p1') === 'false') {
    filterState.priority.P1 = false;
    document.getElementById('filter-p1').checked = false;
  }
  
  if (params.get('p2') === 'false') {
    filterState.priority.P2 = false;
    document.getElementById('filter-p2').checked = false;
  }
  
  // Apply type params
  if (params.get('added') === 'false') {
    filterState.type.added = false;
    filterState.type['file-added'] = false;
    filterState.type['folder-added'] = false;
    document.getElementById('filter-added').checked = false;
  }
  
  if (params.get('removed') === 'false') {
    filterState.type.removed = false;
    filterState.type['file-removed'] = false;
    filterState.type['folder-removed'] = false;
    document.getElementById('filter-removed').checked = false;
  }
  
  if (params.get('modified') === 'false') {
    filterState.type.modified = false;
    document.getElementById('filter-modified').checked = false;
  }
  
  // Apply category params
  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  categoryCheckboxes.forEach(checkbox => {
    const category = checkbox.dataset.category;
    if (params.get(`cat_${category}`) === 'false') {
      filterState.category[category] = false;
      checkbox.checked = false;
    }
  });
  
  // Apply search param
  const searchValue = params.get('search');
  if (searchValue) {
    filterState.search = searchValue;
    document.getElementById('search-input').value = searchValue;
  }
  
  // Apply filters
  applyFilters();
}
