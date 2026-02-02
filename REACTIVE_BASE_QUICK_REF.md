# ReactiveBase Quick Reference

## Creating a Reactive Base

```typescript
import { createReactiveBase, createReactiveBaseFromYAML } from './index';

// Empty base
const base = createReactiveBase();

// From existing ObsidianBase
const base = createReactiveBase(existingBase);

// From YAML
const base = createReactiveBaseFromYAML(yamlString);
```

## Using with Queries

```typescript
import { ReactiveBaseQuery } from './index';

const query = new ReactiveBaseQuery(source, base.ref);
//                                          ^^^^^^^^ Use .ref property!

const results = query.getViewResults('View Name');
console.log(results.value.items); // Computed ref
```

## Filters

```typescript
// Set (replace)
base.setFilters({ and: ['filter1', 'filter2'] });

// Add (AND with existing)
base.addFilter('file.hasTag("task")');

// Clear
base.clearFilters();
```

## Formulas

```typescript
// Add/update
base.addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)');

// Remove
base.removeFormula('days_old');

// Set all (replace)
base.setFormulas({ days_old: 'expression', priority: 'expression' });

// Clear all
base.clearFormulas();
```

## Properties

```typescript
// Configure
base.configureProperty('formula.days_old', { displayName: 'Days Old' });

// Remove
base.removePropertyConfig('formula.days_old');

// Set all (replace)
base.setProperties({ 'formula.days_old': { displayName: 'Days Old' } });

// Clear all
base.clearProperties();
```

## Summaries

```typescript
// Add/update
base.addSummary('custom_avg', 'values.mean().round(2)');

// Remove
base.removeSummary('custom_avg');

// Set all (replace)
base.setSummaries({ custom_avg: 'expression' });

// Clear all
base.clearSummaries();
```

## Views

### Adding Views

```typescript
// Generic view
base.addView(viewObject);

// Table view
base.addTableView('Tasks', {
  order: ['file.name', 'status'],
  filters: 'status != "done"',
  limit: 50,
  groupBy: { property: 'status', direction: 'ASC' },
  summaries: { priority: 'Average' },
  sort: [
    { property: 'file.name', direction: 'ASC' },
    { property: 'status', direction: 'DESC' },
  ],
  columnSize: {
    'file.name': 300,
    'status': 150,
  },
});

// Cards view
base.addCardsView('Projects', {
  order: ['priority', 'file.name'],
  filters: 'file.hasTag("project")',
  limit: 20,
  groupBy: { property: 'status', direction: 'DESC' },
  cardSize: 250,
  image: 'cover',
  imageFit: 'cover',
  imageAspectRatio: 1.4,
});

// List view
base.addListView('Simple', {
  order: ['file.name'],
});

// Map view
base.addMapView('Locations', {
  latProperty: 'lat',
  lngProperty: 'lng',
  titleProperty: 'name',
});
```

### Managing Views

```typescript
// Remove
base.removeView('View Name');

// Update
base.updateView('View Name', (view) => ({
  ...view,
  limit: 100,
}));

// Get
const view = base.getView('View Name');

// Set filters
base.setViewFilters('View Name', 'status == "active"');

// Set order
base.setViewOrder('View Name', ['priority', 'file.name']);

// Set limit
base.setViewLimit('View Name', 50);

// Set groupBy
base.setViewGroupBy('View Name', { property: 'status', direction: 'ASC' });

// Clear all
base.clearViews();
```

## Utility Methods

```typescript
// Convert to YAML
const yaml = base.toYAML();

// Load from YAML
base.fromYAML(yamlString);

// Clone
const copy = base.clone();

// Reset to empty
base.reset();

// Get plain object
const obj = base.toObject();
```

## Accessing Values

```typescript
// Get reactive ref (for queries)
const ref = base.ref;

// Get current value (readonly)
const value = base.value;

// Access specific parts
const filters = base.value.filters;
const formulas = base.value.formulas;
const views = base.value.views;
```

## Fluent API (Chaining)

```typescript
const base = createReactiveBase()
  .setFilters('file.hasTag("task")')
  .addFormula('days_old', 'expression')
  .configureProperty('formula.days_old', { displayName: 'Days Old' })
  .addTableView('Tasks', { order: ['file.name'] })
  .addCardsView('Cards', { order: ['priority'] });
```

## Common Patterns

### Dynamic Configuration

```typescript
// User selects filter
function onFilterChange(filter: string) {
  base.clearFilters();
  base.addFilter(filter);
}

// User adds view
function onAddView(viewName: string, order: string[]) {
  base.addTableView(viewName, { order });
}
```

### Save/Load Configuration

```typescript
// Save
const config = base.toYAML();
localStorage.setItem('config', config);

// Load
const saved = localStorage.getItem('config');
if (saved) {
  base.fromYAML(saved);
}
```

### Experimentation

```typescript
// Clone for testing
const test = base.clone();
test.addFormula('experimental', 'test_expression');

// If good, apply to original
base.addFormula('experimental', 'test_expression');
```

### Conditional Setup

```typescript
const base = createReactiveBase()
  .addFilter('file.hasTag("task")');

if (includeFormulas) {
  base.addFormula('days_old', 'expression');
}

if (userPreference === 'detailed') {
  base.addTableView('Detailed', { order: ['file.name', 'status'] });
} else {
  base.addTableView('Simple', { order: ['file.name'] });
}
```

## Vue Integration

```typescript
<script setup lang="ts">
import { ref } from 'vue';
import { createReactiveBase, ReactiveBaseQuery } from './index';

const source = ref([/* data */]);
const base = createReactiveBase()
  .addFilter('file.hasTag("task")')
  .addTableView('Tasks', { order: ['file.name'] });

const query = new ReactiveBaseQuery(source, base.ref);
const tasks = query.getViewResults('Tasks');

// Modify in response to user actions
function updateFilter(newFilter: string) {
  base.setFilters(newFilter);
  // tasks.value.items automatically updates!
}
</script>

<template>
  <div>
    <ul>
      <li v-for="task in tasks.value.items" :key="task.id">
        {{ task.name }}
      </li>
    </ul>
  </div>
</template>
```

## Tips

- ✅ Always use `base.ref` when passing to `ReactiveBaseQuery`
- ✅ Chain methods for cleaner code
- ✅ Use `.clone()` for safe experimentation
- ✅ Store YAML for configuration persistence
- ✅ Modifications automatically trigger query updates
- ⚠️ Don't mutate `base.value` directly - use methods
- ⚠️ Use `base.ref`, not `ref(base)` with queries

## Error Handling

```typescript
try {
  base.fromYAML(yamlString);
} catch (error) {
  console.error('Invalid YAML:', error);
}

// Check if view exists before modifying
if (base.getView('Tasks')) {
  base.setViewOrder('Tasks', ['file.name']);
}
```

## Performance

- Changes trigger reactive updates in queries
- Only affected computeds re-evaluate
- No performance concerns for typical use cases
- For rapid changes, consider debouncing:

```typescript
import { debounce } from 'lodash';

const updateFilter = debounce((filter: string) => {
  base.setFilters(filter);
}, 300);
```

## Migration from Static Builder

```typescript
// Before
const base = createBase()
  .withFilters(filter)
  .addFormula('test', 'expr')
  .build(); // ❌ Static

// After
const base = createReactiveBase()
  .setFilters(filter)
  .addFormula('test', 'expr');
// ✅ Reactive, no .build()

// Use with query
const query = new ReactiveBaseQuery(source, base.ref);
//                                          ^^^^^^^^
```

## See Also

- [Full Examples](examples/reactive-base-example.ts)
- [Simple Demo](examples/simple-reactive-demo.ts)
- [Migration Guide](MIGRATION_GUIDE.md)
- [Complete Summary](REACTIVE_BASE_SUMMARY.md)
- [README](README.md)
