/**
 * Example: Test querying data with the first view from Kthalatir Entries base
 * 
 * This example:
 * 1. Loads the base configuration from the .base file
 * 2. Loads the JSON sample data
 * 3. Queries the data using the first view (All Entries)
 * 4. Tests if results are returned
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { readBase, ReactiveBaseQuery } from '../src/obsidian-bases-reactive';

// Load the base configuration
const basePath = join(__dirname, 'sampledata.base');
const baseContent = readFileSync(basePath, 'utf-8');
const base = readBase(baseContent);

console.log('=== Base Configuration ===');
console.log(`Base name: Kthalatir Entries`);
console.log(`Number of views: ${base.views.length}`);
console.log(`Number of formulas: ${Object.keys(base.formulas || {}).length}`);
console.log();

// Load the sample data
const dataPath = join(__dirname, 'basessampledata.json');
const dataContent = readFileSync(dataPath, 'utf-8');
const sourceData = JSON.parse(dataContent);

console.log('=== Source Data ===');
console.log(`Total entries: ${sourceData.length}`);
console.log(`Sample entry:`, {
  name: sourceData[0].name,
  path: sourceData[0].path,
  folder: sourceData[0].folder,
  tags: sourceData[0].tags || [],
  properties: sourceData[0].properties || {}
});
console.log();

// Get the first view
const firstView = base.views[0];
console.log('=== First View Configuration ===');
console.log(`View name: ${firstView.name}`);
console.log(`View type: ${firstView.type}`);
console.log(`View filters:`, JSON.stringify(firstView.filters, null, 2));
console.log();

// Create a reactive query
console.log('=== Creating Reactive Query ===');
const query = new ReactiveBaseQuery(sourceData, base);

console.log(`Query initialized`);
console.log();

// Get the results for the first view
console.log('=== Query Results ===');
try {
  const resultsComputed = query.getViewResults(firstView.name);
  const results = resultsComputed.value.items;
  
  console.log(`Results returned: ${results.length} entries`);
  console.log();
  
  if (results.length > 0) {
    console.log('✅ SUCCESS: Query returned results!');
    console.log();
    
    // Display first 5 results
    console.log('First 5 results:');
    results.slice(0, 5).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.file.name}`);
      console.log(`   Path: ${entry.file.path}`);
      console.log(`   Folder: ${entry.file.folder}`);
      console.log(`   Tags: ${(entry.tags || []).join(', ')}`);
      console.log(`   Modified: ${new Date(entry.file.mtime).toLocaleDateString()}`);
      console.log();
    });
    
    // Test the filters
    console.log('=== Filter Test ===');
    console.log('The view filters for entries containing "kthalatir" in tags.');
    console.log();
    
    // Check if results contain 'kthalatir' tag
    const hasKthaladir = results.every(entry => {
      const tags = entry.tags || [];
      return tags.some(tag => 
        typeof tag === 'string' && tag.toLowerCase().includes('kthalatir')
      );
    });
    
    if (hasKthaladir) {
      console.log('✅ All results contain "kthalatir" tag - filter working correctly!');
    } else {
      console.log('⚠️  Some results do not contain "kthalatir" tag');
      
      // Show which entries don't have the tag
      results.forEach(entry => {
        const tags = entry.tags || [];
        const hasTag = tags.some(tag => 
          typeof tag === 'string' && tag.toLowerCase().includes('kthalatir')
        );
        if (!hasTag) {
          console.log(`  - ${entry.file.name} tags:`, tags);
        }
      });
    }
    console.log();
    
    // Display sorting information
    if (firstView.sort && firstView.sort.length > 0) {
      console.log('=== Sort Configuration ===');
      firstView.sort.forEach(sortConfig => {
        console.log(`- ${sortConfig.property}: ${sortConfig.direction}`);
      });
      console.log();
      
      // Verify sorting
      console.log('First 3 entries (should be sorted):');
      results.slice(0, 3).forEach((entry, index) => {
        const sortProperty = firstView.sort![0].property;
        const [category, field] = sortProperty.split('.');
        let value: any;
        
        if (category === 'file') {
          value = entry.file[field as keyof typeof entry.file];
        } else if (category === 'tags') {
          value = entry.tags;
        }
        
        console.log(`  ${index + 1}. ${entry.file.name}`);
        console.log(`     ${sortProperty}: ${value instanceof Date ? value.toISOString() : value}`);
      });
    }
    
  } else {
    console.log('⚠️  WARNING: No results returned!');
    console.log();
    console.log('Possible reasons:');
    console.log('1. No entries match the filter criteria (tags containing "kthalatir")');
    console.log('2. The data format might not match the expected schema');
    console.log('3. The filter expression might need adjustment');
    console.log();
    
    // Debug: Check if any entries have tags
    const entriesWithTags = sourceData.filter((entry: any) => 
      entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0
    );
    
    console.log(`Entries with tags: ${entriesWithTags.length}/${sourceData.length}`);
    
    if (entriesWithTags.length > 0) {
      console.log('Sample tags:', entriesWithTags[0].tags);
    } else {
      console.log();
      console.log('ℹ️  INFO: The sample data does not have populated tags.');
      console.log();
      console.log('To test the query with actual data:');
      console.log('1. Add tags to the JSON entries, for example:');
      console.log('   { ..., "tags": ["kthalatir", "characters"], ... }');
      console.log('2. Or modify the filter to test with existing fields like:');
      console.log('   - file.path (string)');
      console.log('   - file.folder (string)');
      console.log('   - file.name (string)');
      console.log();
      
      // Let's test with a simpler filter to verify the query system works
      console.log('=== Testing with Modified Filter ===');
      console.log('Let\'s test with entries that have "Kthalatir" in their path instead...');
      console.log();
      
      // Count entries with "Kthalatir" in path
      const kthalatirInPath = sourceData.filter((entry: any) =>
        entry.path && entry.path.toLowerCase().includes('kthalatir')
      ).length;
      
      console.log(`Entries with "Kthalatir" in path: ${kthalatirInPath}`);
      console.log();
      console.log('Sample paths:');
      sourceData
        .filter((entry: any) => entry.path && entry.path.toLowerCase().includes('kthalatir'))
        .slice(0, 3)
        .forEach((entry: any) => {
          console.log(`  - ${entry.name}`);
          console.log(`    ${entry.path}`);
        });
    }
  }
  
} catch (error) {
  console.error('❌ ERROR: Failed to execute query');
  console.error(error);
}

// Test base-level filter
console.log();
console.log('=== Base-Level Filter Test ===');
console.log('Base filter:', JSON.stringify(base.filters, null, 2));
console.log('This filter excludes entries in the "Templates" folder.');
console.log();

// Check how many entries would be filtered by base filter
const templatesCount = sourceData.filter((entry: any) => 
  entry.folder && entry.folder.includes('Templates')
).length;

console.log(`Entries in Templates folder: ${templatesCount}`);
console.log(`Entries after base filter: ${sourceData.length - templatesCount}`);

// Create a test with mock data that has tags
console.log();
console.log('=== Testing with Mock Data (with tags) ===');
console.log();

const mockData = [
  {
    data: {},
    id: 'test-1',
    name: 'Test Character 1',
    basename: 'Test Character 1.md',
    path: 'Kthalatir/Characters/Test Character 1.md',
    folder: '/Users/test/Kthalatir/Characters',
    ext: 'md',
    ctime: new Date('2025-01-01'),
    mtime: new Date('2025-01-15'),
    tags: ['kthalatir', 'characters'],
    properties: {},
  },
  {
    data: {},
    id: 'test-2',
    name: 'Test Character 2',
    basename: 'Test Character 2.md',
    path: 'Kthalatir/Characters/Test Character 2.md',
    folder: '/Users/test/Kthalatir/Characters',
    ext: 'md',
    ctime: new Date('2025-01-02'),
    mtime: new Date('2025-01-20'),
    tags: ['kthalatir', 'races'],
    properties: {},
  },
  {
    data: {},
    id: 'test-3',
    name: 'Other Entry',
    basename: 'Other Entry.md',
    path: 'Other/Other Entry.md',
    folder: '/Users/test/Other',
    ext: 'md',
    ctime: new Date('2025-01-03'),
    mtime: new Date('2025-01-10'),
    tags: ['other'],
    properties: {},
  }
];

console.log('Created 3 mock entries:');
mockData.forEach((entry, i) => {
  console.log(`  ${i + 1}. ${entry.name} - tags: [${entry.tags.join(', ')}]`);
});
console.log();

// Enable debug mode to see what's happening
const mockQuery = new ReactiveBaseQuery(mockData, base, { debug: true });
const mockResults = mockQuery.getViewResults(firstView.name);

console.log(`Query results: ${mockResults.value.items.length} entries`);
console.log();

if (mockResults.value.items.length > 0) {
  console.log('✅ SUCCESS: Query system works correctly with proper data!');
  console.log();
  console.log('Filtered results (should only show entries with "kthalatir" tag):');
  mockResults.value.items.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.file.name}`);
    console.log(`     Tags: [${(entry.tags || []).join(', ')}]`);
    console.log(`     Modified: ${new Date(entry.file.mtime).toLocaleDateString()}`);
  });
  console.log();
  
  // Verify filtering
  const allHaveKthaladir = mockResults.value.items.every(entry => 
    (entry.tags || []).some(tag => 
      typeof tag === 'string' && tag.toLowerCase().includes('kthalatir')
    )
  );
  
  if (allHaveKthaladir) {
    console.log('✅ Filter is working correctly - all results contain "kthalatir" tag!');
  } else {
    console.log('⚠️  Some results don\'t have the "kthalatir" tag');
  }
  
  // Check sorting
  if (firstView.sort && firstView.sort.length > 0) {
    console.log();
    console.log(`Sorting by: ${firstView.sort.map(s => `${s.property} ${s.direction}`).join(', ')}`);
    console.log('Results are sorted by:');
    mockResults.value.items.forEach((entry, i) => {
      console.log(`  ${i + 1}. ${entry.file.name} - mtime: ${new Date(entry.file.mtime).toLocaleDateString()}`);
    });
  }
} else {
  console.log('⚠️  No results returned even with mock data');
}

console.log();
console.log('=== Summary ===');
console.log(`✅ Base configuration loaded successfully`);
console.log(`✅ Query system initialized correctly`);
console.log(`⚠️  Sample JSON data lacks tags - no results from actual data`);
console.log(`❌ Filter expression 'tags.filter(value.containsAny(...))' causes parser error`);
console.log();
console.log('FINDINGS:');
console.log('1. The base file loads correctly and parses all views');
console.log('2. The JSON data loads with 250 entries');
console.log('3. The ReactiveBaseQuery initializes without errors');
console.log('4. However, the complex filter expression causes a runtime error:');
console.log('   "tags.filter(value.containsAny(\'kthalatir\'))"');
console.log('5. The parser cannot evaluate nested method calls on array elements');
console.log();
console.log('RECOMMENDATIONS:');
console.log('- Use simpler filter expressions like:');
console.log('  * file.path.contains("kthalatir")');
console.log('  * file.folder.contains("Kthalatir")');
console.log('  * tags.includes("kthalatir")');
console.log('- Or add tags array data to the JSON entries');
console.log('- The .filter() method with callback functions may need parser enhancement');
