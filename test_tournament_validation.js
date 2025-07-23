/**
 * Simple test for tournament validation functions
 * Run with: node test_tournament_validation.js
 */

const { validateTournamentStart, validateTeamFormation } = require('./src/utils/tournamentUtils');

console.log('Testing validateTournamentStart function...\n');

// Test cases for validateTournamentStart
const testCases = [
  { teamCount: 0, expected: false, description: '0 teams' },
  { teamCount: 1, expected: false, description: '1 team' },
  { teamCount: 2, expected: true, description: '2 teams' },
  { teamCount: 3, expected: true, description: '3 teams' },
  { teamCount: 5, expected: true, description: '5 teams' }
];

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  const result = validateTournamentStart(testCase.teamCount);
  const passed = result.allowed === testCase.expected;
  
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`  Expected: ${testCase.expected ? 'allowed' : 'not allowed'}`);
  console.log(`  Got: ${result.allowed ? 'allowed' : 'not allowed'}`);
  if (!result.allowed) {
    console.log(`  Reason: ${result.reason}`);
  }
  console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}\n`);
  
  if (passed) passedTests++;
});

console.log(`\nTest Summary: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('All tests passed! ✅');
  process.exit(0);
} else {
  console.log('Some tests failed! ❌');
  process.exit(1);
}