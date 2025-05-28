#!/usr/bin/env node

/**
 * System Prompt Confidence Score Validation
 */

const { SYSTEM_PROMPT } = require('./server/seed-data');

console.log('=== System Prompt Confidence Score Validation ===\n');

// Check if confidence instructions are present
const hasConfidenceInstructions = SYSTEM_PROMPT.includes('confidence score from 1-3');
const hasConfidenceFormat = SYSTEM_PROMPT.includes('Confidence: [1|2|3]');
const hasConfidenceDefinitions = SYSTEM_PROMPT.includes('Just a guess (0-60% chance');

console.log('✅ System Prompt Updates:');
console.log(`  - Confidence instructions present: ${hasConfidenceInstructions ? '✓' : '✗'}`);
console.log(`  - Confidence format specified: ${hasConfidenceFormat ? '✓' : '✗'}`);
console.log(`  - Confidence definitions included: ${hasConfidenceDefinitions ? '✓' : '✗'}`);

if (hasConfidenceInstructions && hasConfidenceFormat && hasConfidenceDefinitions) {
  console.log('\n🚀 System prompt successfully updated!');
  console.log('   Claude will now be instructed to provide confidence scores.');
  console.log('   Next database initialization will use the updated prompt.');
} else {
  console.log('\n❌ System prompt missing confidence instructions');
}

console.log('\n📝 Key Instructions Added:');
console.log('  - "Additionally, provide a confidence score from 1-3..."');
console.log('  - "Format your confidence as \'Confidence: [1|2|3]\' at the end..."');
console.log('  - Definitions: 1=guess, 2=probably, 3=very likely');

console.log('\n🔄 Next Steps:');
console.log('  1. Start the application (database will recreate with new prompt)');
console.log('  2. Run research with verbosity 2 or 3');
console.log('  3. Confidence scores should now appear in terminal output');