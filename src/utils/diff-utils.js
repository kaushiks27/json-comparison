/**
 * Diff utility functions
 */

/**
 * Word-level diff algorithm for highlighting specific changes
 * @param {string|Object} oldStr - Old string or value
 * @param {string|Object} newStr - New string or value
 * @returns {Object} - Diff result
 */
function diffWords(oldStr, newStr) {
  // Convert objects to strings if needed
  if (typeof oldStr !== 'string') oldStr = JSON.stringify(oldStr, null, 2);
  if (typeof newStr !== 'string') newStr = JSON.stringify(newStr, null, 2);
  
  // Simple character diff implementation (in a real implementation, use a proper diff library)
  const oldWords = oldStr.split(/(\s+|\b)/);
  const newWords = newStr.split(/(\s+|\b)/);
  
  let i = 0, j = 0;
  const result = {
    removed: [],
    added: [],
    unchanged: []
  };
  
  // This is a simplified diff - a production version would use a proper diff algorithm
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      // All remaining words in newWords are added
      while (j < newWords.length) {
        result.added.push(j++);
      }
      break;
    }
    
    if (j >= newWords.length) {
      // All remaining words in oldWords are removed
      while (i < oldWords.length) {
        result.removed.push(i++);
      }
      break;
    }
    
    if (oldWords[i] === newWords[j]) {
      result.unchanged.push(j);
      i++;
      j++;
    } else {
      // Try to find the old word later in the new words
      const oldWordPos = newWords.indexOf(oldWords[i], j);
      // Try to find the new word later in the old words
      const newWordPos = oldWords.indexOf(newWords[j], i);
      
      if (oldWordPos === -1 && newWordPos === -1) {
        // Both words are different
        result.removed.push(i++);
        result.added.push(j++);
      } else if (newWordPos === -1 || (oldWordPos !== -1 && oldWordPos <= newWordPos)) {
        // Word was added
        result.added.push(j++);
      } else {
        // Word was removed
        result.removed.push(i++);
      }
    }
  }
  
  return {
    oldWords,
    newWords,
    diff: result
  };
}

module.exports = {
  diffWords
};
