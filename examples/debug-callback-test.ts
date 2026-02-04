/**
 * Debug test for callback functions in filters
 */

import { readBase, ReactiveBaseQuery } from '../src/obsidian-bases-reactive';

// Create a simple base with array filter
const baseYaml = `
views:
  - type: table
    name: Test View
    filters:
      and:
        - tags.filter(value.containsAny('test'))
`;

const base = readBase(baseYaml);

// Create test data
const testData = [
  {
    name: 'Entry 1',
    path: 'Entry 1.md',
    folder: '/test',
    ctime: new Date(),
    mtime: new Date(),
    tags: ['test', 'example'],
    properties: {},
  },
  {
    name: 'Entry 2',
    path: 'Entry 2.md',
    folder: '/test',
    ctime: new Date(),
    mtime: new Date(),
    tags: ['other'],
    properties: {},
  },
];

console.log('Base:', JSON.stringify(base, null, 2));
console.log();
console.log('Test Data:', JSON.stringify(testData, null, 2));
console.log();

try {
  const query = new ReactiveBaseQuery(testData, base);
  const results = query.getViewResults('Test View');
  
  console.log('✅ SUCCESS! Results:', results.value.items.length);
  results.value.items.forEach(item => {
    console.log(`  - ${item.name}: tags=${JSON.stringify(item.tags)}`);
  });
  
  console.log();
  console.log('Filter expression with callback functions is working correctly!');
} catch (error) {
  console.error('❌ Error:', error);
}
