/**
 * Filtering functionality for report UI
 */

// Apply filters to the report
function applyFilters() {
  if (!window.filterState) return;
  
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
    const matchesPriority = window.filterState.priority[priority];
    const matchesType = window.filterState.type[type];
    const matchesCategory = window.filterState.category[category] !== false; // Default to true if undefined
    
    // Check if item matches search
    const matchesSearch = window.filterState.search === '' || 
      item.textContent.toLowerCase().includes(window.filterState.search);
    
    const isVisible = matchesPriority && matchesType && matchesCategory && matchesSearch;
    
    // Show/hide item
    item.style.display = isVisible ? 'block' : 'none';
    
    if (isVisible) matchCount++;
  });
  
  // Update search results
  if (window.filterState.search !== '' && searchResults) {
    searchResults.textContent = `Found ${matchCount} matches`;
    searchResults.style.display = 'block';
  } else if (searchResults) {
    searchResults.style.display = 'none';
  }
  
  // Update executive summary items
  const summaryItems = document.querySelectorAll('#executive-summary li');
  summaryItems.forEach(item => {
    const priority = item.dataset.priority;
    const type = item.dataset.type;
    const category = item.dataset.category;
    
    const matchesPriority = window.filterState.priority[priority];
    const matchesType = window.filterState.type[type];
    const matchesCategory = window.filterState.category[category] !== false;
    const matchesSearch = window.filterState.search === '' || 
      item.textContent.toLowerCase().includes(window.filterState.search);
    
    item.style.display = (matchesPriority && matchesType && matchesCategory && matchesSearch) ? 'list-item' : 'none';
  });
  
  // Update URL parameters
  updateUrlParams();
}

// Reset all filters
function resetFilters() {
  if (!window.filterState) return;
  
  // Reset priority filters
  window.filterState.priority.P0 = true;
  window.filterState.priority.P1 = true;
  window.filterState.priority.P2 = true;
  
  document.querySelectorAll('[id^="filter-p"]').forEach(element => {
    element.checked = true;
  });
  
  // Reset type filters
  const typeFilters = {
    'filter-added': ['added', 'file-added', 'folder-added'],
    'filter-removed': ['removed', 'file-removed', 'folder-removed'],
    'filter-modified': ['modified']
  };
  
  Object.entries(typeFilters).forEach(([filterId, types]) => {
    const element = document.getElementById(filterId);
    if (element) {
      element.checked = true;
      types.forEach(type => {
        window.filterState.type[type] = true;
      });
    }
  });
  
  // Reset category filters
  document.querySelectorAll('[id^="filter-"][data-category]').forEach(element => {
    element.checked = true;
    window.filterState.category[element.dataset.category] = true;
  });
  
  // Reset search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    window.filterState.search = '';
  }
  
  // Apply filters
  applyFilters();
}

// Update URL parameters to reflect current filter state
function updateUrlParams() {
  if (!window.filterState) return;
  
  const params = new URLSearchParams();
  
  // Add priority params
  if (!window.filterState.priority.P0) params.append('p0', 'false');
  if (!window.filterState.priority.P1) params.append('p1', 'false');
  if (!window.filterState.priority.P2) params.append('p2', 'false');
  
  // Add type params
  if (!window.filterState.type.added) params.append('added', 'false');
  if (!window.filterState.type.removed) params.append('removed', 'false');
  if (!window.filterState.type.modified) params.append('modified', 'false');
  
  // Add category params
  for (const [category, enabled] of Object.entries(window.filterState.category)) {
    if (!enabled) params.append(`cat_${category}`, 'false');
  }
  
  // Add search param
  if (window.filterState.search) params.append('search', window.filterState.search);
  
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
  if (!window.filterState) return;
  
  try {
    const params = new URLSearchParams(window.location.search);
    
    // Apply priority params
    if (params.get('p0') === 'false') {
      window.filterState.priority.P0 = false;
      const p0Filter = document.getElementById('filter-p0');
      if (p0Filter) p0Filter.checked = false;
    }
    
    if (params.get('p1') === 'false') {
      window.filterState.priority.P1 = false;
      const p1Filter = document.getElementById('filter-p1');
      if (p1Filter) p1Filter.checked = false;
    }
    
    if (params.get('p2') === 'false') {
      window.filterState.priority.P2 = false;
      const p2Filter = document.getElementById('filter-p2');
      if (p2Filter) p2Filter.checked = false;
    }
    
    // Apply type params
    if (params.get('added') === 'false') {
      window.filterState.type.added = false;
      window.filterState.type['file-added'] = false;
      window.filterState.type['folder-added'] = false;
      const addedFilter = document.getElementById('filter-added');
      if (addedFilter) addedFilter.checked = false;
    }
    
    if (params.get('removed') === 'false') {
      window.filterState.type.removed = false;
      window.filterState.type['file-removed'] = false;
      window.filterState.type['folder-removed'] = false;
      const removedFilter = document.getElementById('filter-removed');
      if (removedFilter) removedFilter.checked = false;
    }
    
    if (params.get('modified') === 'false') {
      window.filterState.type.modified = false;
      const modifiedFilter = document.getElementById('filter-modified');
      if (modifiedFilter) modifiedFilter.checked = false;
    }
    
    // Apply category params
    document.querySelectorAll('[id^="filter-"][data-category]').forEach(checkbox => {
      const category = checkbox.dataset.category;
      if (params.get(`cat_${category}`) === 'false') {
        window.filterState.category[category] = false;
        checkbox.checked = false;
      }
    });
    
    // Apply search param
    const searchValue = params.get('search');
    if (searchValue) {
      window.filterState.search = searchValue;
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = searchValue;
    }
    
    // Apply filters
    applyFilters();
  } catch (error) {
    console.warn('Error applying URL parameters:', error);
  }
}