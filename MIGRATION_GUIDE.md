# Migration Guide: Static Builder to Reactive Base

This guide helps you migrate from the static `BaseBuilder` pattern to the new `ReactiveBase` class.

## Overview

The `ReactiveBase` class provides the same fluent API as `BaseBuilder` but with full reactivity support, allowing you to modify base configurations in real-time and have changes automatically propagate to queries.

## Quick Migration

### Before (Static Builder)

```typescript
import { createBase, ReactiveBaseQuery } from './index';

// Build a static base
const base = createBase()
  .withFilters('file.hasTag("task")')
  .addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)')
  .addTableView('Tasks', { order: ['file.name'] })
  .build(); // Returns plain object

// Use with query
const query = new ReactiveBaseQuery(source, base);
const results = query.getViewResults('Tasks');

// ❌ Cannot modify base after build
// Need to rebuild from scratch for any changes
```

### After (Reactive Base)

```typescript
import { createReactiveBase, ReactiveBaseQuery } from './index';

// Create a reactive base
const base = createReactiveBase()
  .addFilter('file.hasTag("task")')
  .addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)')
  .addTableView('Tasks', { order: ['file.name'] });
// No .build() - stays reactive!

// Use with query (pass base.ref)
const query = new ReactiveBaseQuery(source, base.ref);
const results = query.getViewResults('Tasks');

// ✅ Can modify anytime - changes automatically update results
base.addFormula('priority_label', 'if(priority == 1, "High", "Low")');
base.setViewOrder('Tasks', ['formula.priority_label', 'file.name']);
```

## Key Differences

### Method Names

Most methods are the same, with a few changes:

| Static Builder | Reactive Base | Notes |
|----------------|---------------|-------|
| `.withFilters()` | `.setFilters()` | More consistent naming |
| `.build()` | _removed_ | No build step needed |
| N/A | `.ref` | Get reactive ref for queries |
| N/A | `.toYAML()` | Convert to YAML string |
| N/A | `.fromYAML()` | Load from YAML string |
| N/A | `.clone()` | Clone the base |
| N/A | `.reset()` | Reset to empty state |

### Usage Patterns

#### 1. Creating a Base

**Before:**
```typescript
const base = createBase()
  .withFilters(filter)
  .addFormula('test', 'expression')
  .build();
```

**After:**
```typescript
const base = createReactiveBase()
  .setFilters(filter)
  .addFormula('test', 'expression');
// No .build()
```

#### 2. Using with Queries

**Before:**
```typescript
const query = new ReactiveBaseQuery(source, base);
```

**After:**
```typescript
const query = new ReactiveBaseQuery(source, base.ref);
// Note: Use base.ref instead of base
```

#### 3. Modifying After Creation

**Before:**
```typescript
// ❌ Not possible - need to rebuild
const newBase = createBase()
  .withFilters(base.filters)
  .withFormulas(base.formulas)
  .addFormula('new_formula', 'expression')
  .build();
```

**After:**
```typescript
// ✅ Just modify directly
base.addFormula('new_formula', 'expression');
// All queries automatically update!
```

## Common Migration Scenarios

### Scenario 1: Simple Static Configuration

**Before:**
```typescript
const base = createBase()
  .addFilter('file.hasTag("project")')
  .addTableView('Projects', { order: ['file.name'] })
  .build();

const yaml = serializeToYAML(base);
```

**After:**
```typescript
const base = createReactiveBase()
  .addFilter('file.hasTag("project")')
  .addTableView('Projects', { order: ['file.name'] });

const yaml = base.toYAML();
```

### Scenario 2: Loading from YAML

**Before:**
```typescript
import { readBase, ReactiveBaseQuery } from './index';

const yaml = '...';
const base = readBase(yaml);
const query = new ReactiveBaseQuery(source, base);

// Cannot modify base
```

**After:**
```typescript
import { createReactiveBaseFromYAML, ReactiveBaseQuery } from './index';

const yaml = '...';
const base = createReactiveBaseFromYAML(yaml);
const query = new ReactiveBaseQuery(source, base.ref);

// Can modify base
base.addFormula('new_formula', 'expression');
```

### Scenario 3: Dynamic View Creation

**Before:**
```typescript
// Not easily possible - would need to rebuild entire base
function addViewToBase(existingBase: ObsidianBase, viewName: string) {
  const builder = createBase()
    .withFilters(existingBase.filters)
    .withFormulas(existingBase.formulas)
    .withProperties(existingBase.properties);
  
  existingBase.views.forEach(v => builder.addView(v));
  builder.addTableView(viewName, { order: ['file.name'] });
  
  return builder.build();
}
```

**After:**
```typescript
// Simple and reactive!
function addViewToBase(base: ReactiveBase, viewName: string) {
  base.addTableView(viewName, { order: ['file.name'] });
  // Done! All queries automatically see the new view
}
```

### Scenario 4: Conditional Configuration

**Before:**
```typescript
const builder = createBase().addFilter('file.hasTag("task")');

if (includeFormulas) {
  builder.addFormula('days_old', 'expression');
}

if (userPreference === 'detailed') {
  builder.addTableView('Detailed', { order: ['file.name', 'status'] });
} else {
  builder.addTableView('Simple', { order: ['file.name'] });
}

const base = builder.build();
```

**After:**
```typescript
const base = createReactiveBase().addFilter('file.hasTag("task")');

if (includeFormulas) {
  base.addFormula('days_old', 'expression');
}

if (userPreference === 'detailed') {
  base.addTableView('Detailed', { order: ['file.name', 'status'] });
} else {
  base.addTableView('Simple', { order: ['file.name'] });
}

// No .build() - already reactive
```

### Scenario 5: User-Driven Configuration

**Before:**
```typescript
// Would require rebuilding the base on each user action
let currentBase = createBase()
  .addFilter('file.hasTag("task")')
  .build();

function onUserAddFilter(filter: string) {
  // Rebuild entire base
  const builder = createBase()
    .withFilters({ and: [currentBase.filters, filter] });
  
  // Re-add all existing content
  if (currentBase.formulas) builder.withFormulas(currentBase.formulas);
  currentBase.views.forEach(v => builder.addView(v));
  
  currentBase = builder.build();
  
  // Need to update query with new base
  query.setBase(currentBase);
}
```

**After:**
```typescript
// Simple reactive updates
const base = createReactiveBase()
  .addFilter('file.hasTag("task")');

const query = new ReactiveBaseQuery(source, base.ref);

function onUserAddFilter(filter: string) {
  // Just add the filter - automatic update!
  base.addFilter(filter);
}
```

## Vue Integration

### Using in Vue Components

**Before:**
```typescript
import { ref } from 'vue';
import { createBase, useBaseQuery } from './index';

const base = createBase()
  .addFilter('file.hasTag("task")')
  .build();

const source = ref([...]);
const { getViewResults } = useBaseQuery(source, base);
```

**After:**
```typescript
import { ref } from 'vue';
import { createReactiveBase, useBaseQuery } from './index';

const base = createReactiveBase()
  .addFilter('file.hasTag("task")');

const source = ref([...]);
const { getViewResults } = useBaseQuery(source, base.ref);

// Can modify base anywhere in your component
function addDynamicFilter(filter: string) {
  base.addFilter(filter);
  // Results automatically update!
}
```

### Reactive Configuration UI

```typescript
<script setup lang="ts">
import { createReactiveBase, ReactiveBaseQuery } from './index';

const base = createReactiveBase()
  .addFilter('file.hasTag("task")')
  .addTableView('Tasks', { order: ['file.name'] });

const source = ref([...]);
const query = new ReactiveBaseQuery(source, base.ref);
const results = query.getViewResults('Tasks');

// User actions directly modify the base
function updateFilter(newFilter: string) {
  base.clearFilters();
  base.addFilter(newFilter);
}

function addView(viewName: string) {
  base.addTableView(viewName, { order: ['file.name'] });
}

function updateViewOrder(viewName: string, order: string[]) {
  base.setViewOrder(viewName, order);
}
</script>

<template>
  <div>
    <input @change="updateFilter($event.target.value)" placeholder="Filter...">
    <button @click="addView('New View')">Add View</button>
    
    <ul>
      <li v-for="item in results.value.items" :key="item.id">
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>
```

## Advanced Features

### 1. Cloning for Experimentation

```typescript
// Create a clone to test changes without affecting original
const testBase = base.clone();

testBase.addFormula('experimental', 'test_expression');
testBase.addTableView('Test View', { order: ['file.name'] });

// If you like the changes, apply them to original
base.addFormula('experimental', 'test_expression');
base.addTableView('Test View', { order: ['file.name'] });
```

### 2. Saving and Loading

```typescript
// Save current configuration
const yaml = base.toYAML();
localStorage.setItem('baseConfig', yaml);

// Load saved configuration
const savedYaml = localStorage.getItem('baseConfig');
if (savedYaml) {
  base.fromYAML(savedYaml);
}
```

### 3. Resetting to Defaults

```typescript
// Reset to empty state
base.reset();

// Reapply default configuration
base
  .addFilter('file.hasTag("task")')
  .addTableView('Default', { order: ['file.name'] });
```

## Performance Considerations

- `ReactiveBase` uses Vue's reactivity system, which is highly optimized
- Modifications trigger reactive updates only in dependent computed properties
- No need to worry about performance for typical use cases
- For very large datasets (10k+ items), consider debouncing rapid changes

## Migration Checklist

- [ ] Replace `createBase()` with `createReactiveBase()`
- [ ] Remove `.build()` calls
- [ ] Change `.withFilters()` to `.setFilters()`
- [ ] Update query creation to use `base.ref` instead of `base`
- [ ] Replace `serializeToYAML(base)` with `base.toYAML()`
- [ ] Replace `readBase(yaml)` with `createReactiveBaseFromYAML(yaml)`
- [ ] Update any base reconstruction logic to use modification methods
- [ ] Test reactive updates in your application

## Need Help?

If you encounter issues during migration, please:

1. Check the examples in `examples/reactive-base-example.ts`
2. Review the API documentation in the README
3. Open an issue on GitHub with your specific use case

## When to Keep Using Static Builder

You might want to keep using the static builder if:

- You have purely static configurations that never change
- You don't need reactivity at all
- You're generating bases programmatically for export only

In these cases, the static builder is still supported and works perfectly fine.
