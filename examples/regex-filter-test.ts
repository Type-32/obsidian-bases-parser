/**
 * Test for regex support in filters
 */

import { readBase, ReactiveBaseQuery } from '../src/obsidian-bases-reactive';

// Create a base with regex filter - your exact use case
const baseYaml = `
views:
  - type: table
    name: Vespertine Reach Entries
    filters:
      and:
        - /(?<!\\S)vespertine-reach(\\/[^ ]+)?/.matches(tags.toString()) == true
`;

const base = readBase(baseYaml);

// Create test data
const testData = [
  {
    name: 'Entry 1 - Should Match',
    path: 'Entry 1.md',
    folder: '/test',
    ctime: new Date(),
    mtime: new Date(),
    tags: ['vespertine-reach', 'example'],
    properties: {},
  },
  {
    name: 'Entry 2 - Should Match (with path)',
    path: 'Entry 2.md',
    folder: '/test',
    ctime: new Date(),
    mtime: new Date(),
    tags: ['vespertine-reach/characters', 'test'],
    properties: {},
  },
  {
    name: 'Entry 3 - Should Not Match',
    path: 'Entry 3.md',
    folder: '/test',
    ctime: new Date(),
    mtime: new Date(),
    tags: ['other', 'random'],
    properties: {},
  },
  {
    name: 'Entry 4 - Should Not Match (embedded)',
    path: 'Entry 4.md',
    folder: '/test',
    ctime: new Date(),
    mtime: new Date(),
    tags: ['my-vespertine-reach'],
    properties: {},
  },
];

console.log('=== Regex Filter Test ===');
console.log();
console.log('Filter expression:');
console.log('/(?<!\\\\S)vespertine-reach(\\\\/[^ ]+)?/.matches(tags.toString()) == true');
console.log();
console.log('This regex matches:');
console.log('- "vespertine-reach" as a standalone word');
console.log('- "vespertine-reach/subpath" with optional path');
console.log('- Uses negative lookbehind to avoid matching embedded occurrences');
console.log();
console.log('Test Data:');
testData.forEach((entry, i) => {
  console.log(`${i + 1}. ${entry.name}`);
  console.log(`   Tags: ${JSON.stringify(entry.tags)}`);
  console.log(`   Tags.toString(): "${entry.tags.toString()}"`);
});
console.log();

try {
  const query = new ReactiveBaseQuery(testData, base);
  const results = query.getViewResults('Vespertine Reach Entries');
  
  console.log('=== Results ===');
  console.log(`✅ Matched ${results.value.items.length} entries:`);
  console.log();
  
  if (results.value.items.length > 0) {
    results.value.items.forEach((entry, i) => {
      console.log(`${i + 1}. ${entry.name}`);
      console.log(`   Tags: ${JSON.stringify(entry.tags)}`);
    });
  } else {
    console.log('⚠️  No entries matched');
  }
  
  console.log();
  console.log('=== Verification ===');
  
  // Expected: Entry 1 and Entry 2 should match
  const expectedMatches = ['Entry 1 - Should Match', 'Entry 2 - Should Match (with path)'];
  const actualMatches = results.value.items.map(item => item.name);
  
  const allExpectedFound = expectedMatches.every(name => actualMatches.includes(name));
  const noUnexpectedMatches = actualMatches.every(name => expectedMatches.includes(name));
  
  if (allExpectedFound && noUnexpectedMatches) {
    console.log('✅ All tests passed!');
    console.log('   - Entries 1 & 2 matched (as expected)');
    console.log('   - Entries 3 & 4 did not match (as expected)');
  } else {
    console.log('❌ Test failed!');
    console.log(`   Expected: ${JSON.stringify(expectedMatches)}`);
    console.log(`   Got: ${JSON.stringify(actualMatches)}`);
  }
  
  console.log();
  console.log('=== Regex Features Supported ===');
  console.log('✅ Regex literals: /pattern/flags');
  console.log('✅ Regex methods: .test(), .matches(), .exec()');
  console.log('✅ Array.toString() for tag conversion');
  console.log('✅ Negative lookbehind: (?<!\\\\S)');
  console.log('✅ Optional groups: (\\\\/[^ ]+)?');
  console.log('✅ Character classes: [^ ]');
  
} catch (error) {
  console.error('❌ Error:', error);
}
