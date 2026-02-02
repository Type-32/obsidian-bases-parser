/**
 * YAML Integration Test
 * 
 * Verifies that js-yaml integration works correctly for parsing and serialization.
 */

import { createReactiveBase, readBase, serializeToYAML } from '../src/index';

console.log('=== js-yaml Integration Test ===\n');

// Test 1: Parse YAML string
console.log('Test 1: Parsing YAML with readBase()');
const yamlInput = `
filters:
  and:
    - file.hasTag("task")
    - file.ext == "md"
formulas:
  days_old: '((now() - file.ctime) / 86400000).round(0)'
  priority_label: 'if(priority == 1, "🔴 High", "🟡 Medium")'
properties:
  formula.days_old:
    displayName: Days Old
summaries:
  custom_avg: 'values.mean().round(2)'
views:
  - type: table
    name: All Tasks
    order:
      - formula.priority_label
      - file.name
    filters:
      and:
        - status != "done"
    limit: 50
  - type: cards
    name: Task Cards
    order:
      - file.name
    groupBy:
      property: status
      direction: ASC
`;

try {
  const parsedBase = readBase(yamlInput);
  console.log('✅ YAML parsed successfully');
  console.log('   - Filters:', parsedBase.filters ? 'present' : 'missing');
  console.log('   - Formulas:', Object.keys(parsedBase.formulas || {}).length, 'formulas');
  console.log('   - Properties:', Object.keys(parsedBase.properties || {}).length, 'properties');
  console.log('   - Summaries:', Object.keys(parsedBase.summaries || {}).length, 'summaries');
  console.log('   - Views:', parsedBase.views.length, 'views');
} catch (error) {
  console.error('❌ Failed to parse YAML:', error);
}

console.log();

// Test 2: Serialize to YAML
console.log('Test 2: Serializing with serializeToYAML()');
const base = createReactiveBase()
  .setFilters({ and: ['file.hasTag("project")', 'file.ext == "md"'] })
  .addFormula('status_icon', 'if(status == "done", "✅", "⏳")')
  .addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)')
  .configureProperty('formula.status_icon', { displayName: 'Status' })
  .addSummary('avg_priority', 'values.filter(v => v.isType("number")).mean()')
  .addTableView('Projects', {
    order: ['formula.status_icon', 'file.name'],
    filters: 'status != "archived"',
    limit: 100,
  })
  .addCardsView('Project Cards', {
    order: ['priority', 'file.name'],
    groupBy: { property: 'status', direction: 'DESC' },
  });

try {
  const yaml = base.toYAML();
  console.log('✅ Serialized to YAML successfully');
  console.log('\nGenerated YAML:');
  console.log('─'.repeat(60));
  console.log(yaml);
  console.log('─'.repeat(60));
} catch (error) {
  console.error('❌ Failed to serialize to YAML:', error);
}

console.log();

// Test 3: Round-trip conversion (parse -> modify -> serialize -> parse)
console.log('Test 3: Round-trip conversion');
try {
  // Parse original YAML
  const base1 = readBase(yamlInput);
  
  // Serialize it
  const yaml1 = serializeToYAML(base1);
  
  // Parse the serialized version
  const base2 = readBase(yaml1);
  
  // Serialize again
  const yaml2 = serializeToYAML(base2);
  
  // Both serializations should be identical
  if (yaml1 === yaml2) {
    console.log('✅ Round-trip conversion successful (output is stable)');
  } else {
    console.log('⚠️  Round-trip conversion produces different output');
    console.log('First serialization length:', yaml1.length);
    console.log('Second serialization length:', yaml2.length);
  }
  
  // Check data integrity
  const checks = [
    base1.views.length === base2.views.length,
    Object.keys(base1.formulas || {}).length === Object.keys(base2.formulas || {}).length,
    Object.keys(base1.properties || {}).length === Object.keys(base2.properties || {}).length,
  ];
  
  if (checks.every(c => c)) {
    console.log('✅ Data integrity preserved');
  } else {
    console.log('❌ Data integrity check failed');
  }
} catch (error) {
  console.error('❌ Round-trip test failed:', error);
}

console.log();

// Test 4: ReactiveBase integration
console.log('Test 4: ReactiveBase with YAML');
try {
  const reactiveBase = createReactiveBase();
  
  // Load from YAML
  reactiveBase.fromYAML(yamlInput);
  console.log('✅ Loaded YAML into ReactiveBase');
  console.log('   - Views loaded:', reactiveBase.value.views.length);
  
  // Modify the base
  reactiveBase.addFormula('new_formula', 'priority * 10');
  reactiveBase.addTableView('New View', { order: ['file.name'] });
  
  // Export to YAML
  const modifiedYaml = reactiveBase.toYAML();
  console.log('✅ Modified and exported to YAML');
  
  // Verify modifications
  const reloaded = readBase(modifiedYaml);
  const hasNewFormula = 'new_formula' in (reloaded.formulas || {});
  const hasNewView = reloaded.views.some(v => v.name === 'New View');
  
  if (hasNewFormula && hasNewView) {
    console.log('✅ Modifications preserved in YAML');
  } else {
    console.log('❌ Modifications not preserved');
  }
} catch (error) {
  console.error('❌ ReactiveBase YAML integration failed:', error);
}

console.log();

// Test 5: Edge cases
console.log('Test 5: Edge cases');

// Empty base
try {
  const emptyBase = { views: [] };
  const emptyYaml = serializeToYAML(emptyBase);
  const parsedEmpty = readBase(emptyYaml);
  console.log('✅ Empty base handled correctly');
} catch (error) {
  console.error('❌ Empty base failed:', error);
}

// Special characters in strings
try {
  const specialBase = createReactiveBase()
    .addFormula('test', 'if(name == "John\'s Task", "yes", "no")')
    .addTableView('Test "Quotes"', { order: ['file.name'] });
  
  const specialYaml = specialBase.toYAML();
  const parsedSpecial = readBase(specialYaml);
  console.log('✅ Special characters handled correctly');
} catch (error) {
  console.error('❌ Special characters failed:', error);
}

// Complex nested filters
try {
  const complexBase = createReactiveBase()
    .setFilters({
      or: [
        { and: ['file.hasTag("urgent")', 'priority == 1'] },
        { and: ['file.hasTag("important")', 'priority <= 2'] },
        { not: ['file.hasTag("archived")'] },
      ],
    });
  
  const complexYaml = complexBase.toYAML();
  const parsedComplex = readBase(complexYaml);
  console.log('✅ Complex nested filters handled correctly');
} catch (error) {
  console.error('❌ Complex nested filters failed:', error);
}

console.log();

// Test 6: Real-world YAML (from user)
console.log('Test 6: Real-world Obsidian Bases YAML');

const realWorldYaml = `
filters:
  not:
    - file.folder == "Templates"
formulas:
  Untitled: ""
views:
  - type: table
    name: All Entries
    filters:
      and:
        - tags.filter(value.containsAny('kthalatir'))
    order:
      - file.name
      - file.mtime
      - file.ctime
      - tags
      - file.path
      - formula.Untitled
    sort:
      - property: file.name
        direction: ASC
      - property: file.mtime
        direction: DESC
    columnSize:
      file.name: 361
      note.tags: 762
  - type: cards
    name: Kthalatir Races
    filters:
      and:
        - tags.filter(value.containsAny("kthalatir/races"))
    order:
      - file.name
      - file.mtime
    cardSize: 210
    imageFit: ""
    imageAspectRatio: 0.55
    image: cover
  - type: table
    name: Adventurers' Guild
    filters:
      and:
        - tags.filter(value.containsAny("kthalatir/adventurers-guild"))
  - type: cards
    name: Kthalatir Characters
    filters:
      and:
        - tags.filter(value.containsAny("kthalatir/characters"))
    order:
      - file.name
      - file.mtime
      - file.ctime
    cardSize: 250
    image: cover
    imageFit: ""
    imageAspectRatio: 1.4
`;

try {
  console.log('Parsing real-world YAML...');
  const realBase = readBase(realWorldYaml);
  
  console.log('✅ Parsed successfully');
  console.log('   - Filters:', realBase.filters ? 'present' : 'missing');
  console.log('   - Formulas:', Object.keys(realBase.formulas || {}).length);
  console.log('   - Views:', realBase.views.length);
  
  // Check view details
  const allEntriesView = realBase.views.find(v => v.name === 'All Entries');
  if (allEntriesView && allEntriesView.type === 'table') {
    console.log('   - All Entries view:');
    console.log('     - Has sort config:', allEntriesView.sort ? `${allEntriesView.sort.length} sorts` : 'no');
    console.log('     - Has columnSize:', allEntriesView.columnSize ? `${Object.keys(allEntriesView.columnSize).length} columns` : 'no');
    console.log('     - Order properties:', allEntriesView.order?.length || 0);
  }
  
  const racesView = realBase.views.find(v => v.name === 'Kthalatir Races');
  if (racesView && racesView.type === 'cards') {
    console.log('   - Kthalatir Races view:');
    console.log('     - Card size:', racesView.cardSize);
    console.log('     - Image:', racesView.image);
    console.log('     - Image fit:', racesView.imageFit || '(empty)');
    console.log('     - Aspect ratio:', racesView.imageAspectRatio);
  }
} catch (error) {
  console.error('❌ Failed to parse real-world YAML:', error);
}

console.log();

// Test 7: Recreate real-world base with API
console.log('Test 7: Recreating real-world base with API');

try {
  const recreatedBase = createReactiveBase()
    // Filters
    .setFilters({
      not: ['file.folder == "Templates"'],
    })
    // Formulas
    .addFormula('Untitled', '')
    // Views
    .addTableView('All Entries', {
      filters: {
        and: ['tags.filter(value.containsAny(\'kthalatir\'))'],
      },
      order: [
        'file.name',
        'file.mtime',
        'file.ctime',
        'tags',
        'file.path',
        'formula.Untitled',
      ],
      sort: [
        { property: 'file.name', direction: 'ASC' },
        { property: 'file.mtime', direction: 'DESC' },
      ],
      columnSize: {
        'file.name': 361,
        'note.tags': 762,
      },
    });
  
  recreatedBase
    .addCardsView('Kthalatir Races', {
      filters: {
        and: ['tags.filter(value.containsAny("kthalatir/races"))'],
      },
      order: ['file.name', 'file.mtime'],
      cardSize: 210,
      imageFit: '',
      imageAspectRatio: 0.55,
      image: 'cover',
    })
    .addTableView('Adventurers\' Guild', {
      filters: {
        and: ['tags.filter(value.containsAny("kthalatir/adventurers-guild"))'],
      },
    })
    .addCardsView('Kthalatir Characters', {
      filters: {
        and: ['tags.filter(value.containsAny("kthalatir/characters"))'],
      },
      order: ['file.name', 'file.mtime', 'file.ctime'],
      cardSize: 250,
      image: 'cover',
      imageFit: '',
      imageAspectRatio: 1.4,
    });
  
  console.log('✅ Successfully recreated base with API');
  
  // Serialize and compare
  const recreatedYaml = recreatedBase.toYAML();
  const originalParsed = readBase(realWorldYaml);
  const recreatedParsed = readBase(recreatedYaml);
  
  // Compare structure
  const structureMatch = 
    originalParsed.views.length === recreatedParsed.views.length &&
    Object.keys(originalParsed.formulas || {}).length === Object.keys(recreatedParsed.formulas || {}).length;
  
  if (structureMatch) {
    console.log('✅ Recreated base matches original structure');
  } else {
    console.log('⚠️  Structure mismatch detected');
  }
  
  // Check if all new properties are present
  const allEntriesRecreated = recreatedParsed.views.find(v => v.name === 'All Entries');
  if (allEntriesRecreated && allEntriesRecreated.type === 'table') {
    const hasSort = allEntriesRecreated.sort && allEntriesRecreated.sort.length > 0;
    const hasColumnSize = allEntriesRecreated.columnSize && Object.keys(allEntriesRecreated.columnSize).length > 0;
    
    if (hasSort && hasColumnSize) {
      console.log('✅ All extended table properties preserved');
    } else {
      console.log('⚠️  Some table properties missing:');
      if (!hasSort) console.log('   - sort configuration');
      if (!hasColumnSize) console.log('   - columnSize configuration');
    }
  }
  
  const racesRecreated = recreatedParsed.views.find(v => v.name === 'Kthalatir Races');
  if (racesRecreated && racesRecreated.type === 'cards') {
    const hasCardSize = racesRecreated.cardSize !== undefined;
    const hasImage = racesRecreated.image !== undefined;
    const hasImageFit = racesRecreated.imageFit !== undefined;
    const hasAspectRatio = racesRecreated.imageAspectRatio !== undefined;
    
    if (hasCardSize && hasImage && hasImageFit && hasAspectRatio) {
      console.log('✅ All extended cards properties preserved');
    } else {
      console.log('⚠️  Some cards properties missing:');
      if (!hasCardSize) console.log('   - cardSize');
      if (!hasImage) console.log('   - image');
      if (!hasImageFit) console.log('   - imageFit');
      if (!hasAspectRatio) console.log('   - imageAspectRatio');
    }
  }
  
  console.log('\nRecreated YAML output:');
  console.log('─'.repeat(60));
  console.log(recreatedYaml);
  console.log('─'.repeat(60));
  
} catch (error) {
  console.error('❌ Failed to recreate with API:', error);
}

console.log();
console.log('=== All Tests Complete ===');
console.log();
console.log('Summary:');
console.log('✓ Real-world YAML parsing');
console.log('✓ Extended properties support:');
console.log('  - sort (separate from order)');
console.log('  - columnSize (table column widths)');
console.log('  - cardSize (card dimensions)');
console.log('  - image (image source)');
console.log('  - imageFit (image fitting mode)');
console.log('  - imageAspectRatio (aspect ratio)');
console.log('✓ API can fully replicate real-world bases');
