/**
 * UI interactions and event handlers
 */

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Setup theme toggle
  initTheme();
  
  // Generate category filters
  generateCategoryFilters();
  
  // Generate statistics summary
  generateStatsSummary();
  
  // Generate table of contents
  generateTableOfContents();
  
  // Generate executive summary
  generateExecutiveSummary();
  
  // Generate full report content
  generateReportContent();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup back to top button
  setupBackToTop();
  
  // Apply URL parameters if any
  applyUrlParams();
});

// Initialize theme based on preferences
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('theme');
  
  if (storedTheme === 'dark' || (!storedTheme && prefersDarkMode)) {
    document.body.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
  }
  
  themeToggle.addEventListener('change', function() {
    if (this.checked) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  });
}

// Generate category filters based on available categories
function generateCategoryFilters() {
  const categoryFilters = document.getElementById('category-filters');
  const categories = {};
  
  //#!/bin/bash

# Script to set up the directory structure and files for the enhanced change detection project

# Create the directory structure
mkdir -p src/report-generators src/utils templates/scripts

# Create the main entry point
cat > src/index.js << 'EOF'
/**
 * Advanced JSON Functional Change Detection
 * Main entry point
 */

const path = require('path');
const { compareConnectors } = require('./comparator');
const { generateHTMLReport } = require('./report-generators/html-report');
const { generateMarkdownReport } = require('./report-generators/markdown-report');
const { generateJSONReport } = require('./report-generators/json-report');

// Paths to connector directories
const prevPath = path.join(__dirname, '..', 'connectors', 'previous');
const currPath = path.join(__dirname, '..', 'connectors', 'current');

async function run() {
  console.log("🔍 Starting functional change detection...");
  
  // Compare connectors
  console.log(`📂 Analyzing connectors in ${prevPath} and ${currPath}...`);
  const comparisonResult = await compareConnectors(prevPath, currPath);
  
  // Generate reports
  console.log("📝 Generating reports...");
  
  // Generate HTML report
  await generateHTMLReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.html'));
  console.log("✅ HTML report generated: functional-change-report.html");
  
  // Generate Markdown report
  await generateMarkdownReport(comparisonResult, path.join(__dirname, '..', 'functional-change-report.md'));
  console.log("✅ Markdown report generated: functional-change-report.md");
  
  // Generate JSON report
  await generateJSONReport(comparisonResult, path.join(__dirname, '..', 'functional-change-data.json'));
  console.log("✅ JSON data generated: functional-change-data.json");
  
  console.log("✨ Process complete!");
}

// Run the program
run().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});
