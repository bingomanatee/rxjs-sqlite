/**
 * Recipe step parser utility
 * Parses recipe instructions into individual steps
 */

/**
 * Parse recipe instructions into individual steps
 * @param {string} recipeId - The recipe ID
 * @param {string} instructions - The full recipe instructions
 * @param {object} logger - Logger object for logging
 * @returns {Array} - Array of step objects
 */
function parseRecipeSteps(recipeId, instructions, logger) {
  if (!instructions || instructions.trim().length === 0) {
    return [];
  }

  // First try to split by line breaks
  const lineBreakSteps = splitByLineBreaks(instructions);
  if (lineBreakSteps.length > 1) {
    logger.log(`Generated ${lineBreakSteps.length} steps from line breaks for recipe ${recipeId}`);
    return formatSteps(recipeId, lineBreakSteps);
  }

  // Try to split by common cooking patterns
  const patternSteps = splitByPatterns(instructions);
  if (patternSteps.length > 1) {
    logger.log(`Generated ${patternSteps.length} steps using pattern matching for recipe ${recipeId}`);
    return formatSteps(recipeId, patternSteps);
  }

  // Try manual splitting for complex recipes
  const manualSteps = splitManually(instructions);
  if (manualSteps.length > 1) {
    logger.log(`Generated ${manualSteps.length} steps using manual splitting for recipe ${recipeId}`);
    return formatSteps(recipeId, manualSteps);
  }

  // Last resort: split by sentences
  const sentenceSteps = splitBySentences(instructions);
  logger.log(`Generated ${sentenceSteps.length} steps from sentences for recipe ${recipeId}`);
  return formatSteps(recipeId, sentenceSteps);
}

/**
 * Split instructions by line breaks
 */
function splitByLineBreaks(instructions) {
  return instructions
    .split(/\r?\n|\r/)
    .filter(line => line.trim().length > 0);
}

/**
 * Split instructions by common cooking patterns
 */
function splitByPatterns(instructions) {
  // Normalize text by ensuring periods have spaces after them
  const normalizedText = instructions.replace(/\.([A-Z])/g, '. $1');
  
  // Common cooking instruction patterns
  const patterns = [
    // Numbered steps like "1. Do this"
    /\d+\.\s+[A-Z][^.!?]*[.!?]/g,
    
    // Steps starting with imperative verbs (common cooking actions)
    /(Add|Mix|Stir|Cook|Bake|Fry|Boil|Simmer|Preheat|Prepare|Cut|Chop|Slice|Dice|Mince|Grate|Combine|Pour|Place|Remove|Let|Allow|Serve|Grease|Cover|Put|When|Bake)[^.!?]*[.!?]/g,
    
    // Steps with transition words
    /(Then|Next|Finally|After that|When done|Once|Meanwhile)[^.!?]*[.!?]/g,
  ];
  
  // Try each pattern until we get a reasonable number of steps
  for (const pattern of patterns) {
    const matches = normalizedText.match(pattern) || [];
    if (matches.length > 1) {
      return matches;
    }
  }
  
  return [];
}

/**
 * Split instructions manually for complex recipes
 */
function splitManually(instructions) {
  // Normalize text
  const normalizedText = instructions.replace(/\.([A-Z])/g, '. $1');
  
  // Split points that often separate cooking steps
  const splitPoints = [
    '. ', // Period followed by space
    ' and ', // Conjunction that often separates steps
    '. When ', // Period followed by a conditional
    '. Then ', // Period followed by a sequence
    ', then ', // Comma followed by a sequence
    '. Next, ', // Period followed by a sequence
    ' until ', // Duration/condition marker
  ];
  
  let splits = [normalizedText];
  
  // Try each split point
  for (const splitPoint of splitPoints) {
    if (splits.length < 3) { // Only continue if we don't have enough splits yet
      const newSplits = [];
      
      for (const segment of splits) {
        const parts = segment.split(splitPoint);
        
        if (parts.length > 1) {
          // Process each part
          for (let i = 0; i < parts.length; i++) {
            let part = parts[i].trim();
            
            // Add back the split point to all but the last part
            if (i < parts.length - 1 && splitPoint !== '. ') {
              part += splitPoint.trim();
            }
            
            if (part.length > 0) {
              newSplits.push(part);
            }
          }
        } else {
          // No split occurred, keep the original
          newSplits.push(segment);
        }
      }
      
      splits = newSplits;
    }
  }
  
  // Filter out very short segments (likely not actual steps)
  return splits.filter(step => step.trim().length > 10);
}

/**
 * Split instructions by sentences
 */
function splitBySentences(instructions) {
  return instructions
    .split(/\.\s+/)
    .filter(sentence => sentence.trim().length > 0);
}

/**
 * Format steps into the expected structure
 */
function formatSteps(recipeId, steps) {
  return steps.map((instruction, index) => {
    // Ensure the instruction ends with a period
    let formattedInstruction = instruction.trim();
    if (!formattedInstruction.endsWith('.') && 
        !formattedInstruction.endsWith('!') && 
        !formattedInstruction.endsWith('?')) {
      formattedInstruction += '.';
    }
    
    // Capitalize the first letter
    formattedInstruction = formattedInstruction.charAt(0).toUpperCase() + 
                          formattedInstruction.slice(1);
    
    return {
      id: `generated-step-${recipeId}-${index + 1}`,
      recipeId: recipeId,
      stepNumber: index + 1,
      instruction: formattedInstruction,
      duration: 0,
      image: null
    };
  });
}

module.exports = {
  parseRecipeSteps
};
