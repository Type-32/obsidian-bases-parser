# useBase() Complete Guide

A comprehensive guide to the `useBase()` composable for unified base management.

## Overview

`useBase()` is a Vue composable that provides a complete, reactive interface for managing Obsidian Bases. It combines base configuration, source data management, and querying into one unified API.

## Features

✅ **Unified API** - One composable for everything  
✅ **Reactive** - All changes propagate automatically  
✅ **Change Tracking** - Know when there are unsaved changes  
✅ **Source Management** - CRUD operations on data  
✅ **Full Query Access** - Reactive query results  
✅ **Load/Save** - YAML import/export  
✅ **State & Statistics** - Counts and flags  
✅ **Auto-save Ready** - Tools to implement auto-save  

## Quick Start

```typescript
import { ref } from 'vue';
import { useBase, BaseSource } from './index';

const {
  base,
  source,
  load,
  save,
  addItem,
  getViewResults,
} = useBase({
  source: ref([]),
  trackChanges: true,
});

// Load configuration
load(yamlString);

// Add data
addItem({ id: '1', name: 'Item.md', properties: { status: 'todo' } });

// Query
const results = getViewResults('View Name');

// Save
const yaml = save();
```

## API Reference

### Initialization

```typescript
useBase<T>(options?: UseBaseOptions<T>): UseBaseReturn<T>
```

**Options:**
- `source?: Ref<BaseSource<T>[]> | BaseSource<T>[]` - Initial source data
- `base?: ObsidianBase | string` - Initial base (object or YAML)
- `debug?: boolean` - Enable debug logging
- `customFunctions?: Record<string, Function>` - Custom formula functions
- `trackChanges?: boolean` - Track changes for `hasChanges` flag

### Return Value

#### Base Management

```typescript
base: ReactiveBase
```
The reactive base instance. Access `base.value` to read, or call methods like `base.addFormula()`.

```typescript
isLoaded: Ref<boolean>
```
Whether a base configuration is loaded.

```typescript
hasChanges: Ref<boolean>
```
Whether there are unsaved changes (requires `trackChanges: true`).

```typescript
state: ComputedRef<{
  viewCount: number;
  formulaCount: number;
  propertyCount: number;
  summaryCount: number;
  itemCount: number;
  hasFilters: boolean;
  hasViews: boolean;
  hasFormulas: boolean;
}>
```
Computed statistics about the base and data.

#### Load/Save

```typescript
load(yaml: string): void
```
Load base configuration from YAML string.

```typescript
loadFromObject(base: ObsidianBase): void
```
Load base configuration from object.

```typescript
save(): string
```
Export current base configuration to YAML string.

```typescript
reset(): void
```
Reset base to empty state.

```typescript
clone(): ReactiveBase
```
Create a copy of the current base.

#### Source Data Management

```typescript
source: Ref<BaseSource<T>[]>
```
Reactive array of source data items.

```typescript
setSource(newSource: BaseSource<T>[]): void
```
Replace entire source array.

```typescript
addItem(item: BaseSource<T>): void
```
Add item to source.

```typescript
updateItem(id: string, updates: Partial<BaseSource<T>>): void
```
Update item by ID with partial updates.

```typescript
removeItem(id: string): void
```
Remove item by ID.

```typescript
clearSource(): void
```
Remove all items from source.

#### Query Access

```typescript
query: ReactiveBaseQuery<T>
```
The underlying query instance (advanced use).

```typescript
getViewResults(viewName: string): ComputedRef<ReactiveBaseQueryResult<T>>
```
Get reactive results for a specific view.

```typescript
getAllResults(): ComputedRef<ReactiveBaseQueryResult<T>>
```
Get reactive results with global filters only (no view filters).

```typescript
viewNames: ComputedRef<string[]>
```
Array of available view names.

```typescript
refresh(): void
```
Force refresh all queries.

#### View Management

```typescript
views: ComputedRef<View[]>
```
All views in the base.

```typescript
addView(view: View): void
```
Add a view to the base.

```typescript
removeView(name: string): void
```
Remove view by name.

```typescript
updateView(name: string, updater: (view: View) => View): void
```
Update view by name using updater function.

```typescript
getView(name: string): View | undefined
```
Get view configuration by name.

#### Formula Management

```typescript
formulas: ComputedRef<Formulas | undefined>
```
All formulas in the base.

```typescript
addFormula(name: string, expression: string): void
```
Add or update a formula.

```typescript
removeFormula(name: string): void
```
Remove a formula.

#### Filter Management

```typescript
filters: ComputedRef<Filter | undefined>
```
Global filters.

```typescript
setFilters(filters: Filter): void
```
Set global filters (replaces existing).

```typescript
addFilter(filter: string): void
```
Add filter (AND with existing).

```typescript
clearFilters(): void
```
Remove all global filters.

#### Property Management

```typescript
properties: ComputedRef<Properties | undefined>
```
All property configurations.

```typescript
configureProperty(name: string, config: PropertyConfig): void
```
Configure property display settings.

```typescript
removePropertyConfig(name: string): void
```
Remove property configuration.

#### Summary Management

```typescript
summaries: ComputedRef<Summaries | undefined>
```
All custom summaries.

```typescript
addSummary(name: string, expression: string): void
```
Add or update a custom summary.

```typescript
removeSummary(name: string): void
```
Remove a summary.

## Usage Patterns

### Pattern 1: Simple Viewer

```typescript
const { source, load, getViewResults, viewNames } = useBase({
  source: ref(myData),
});

load(yamlConfig);

const currentView = ref(viewNames.value[0]);
const results = computed(() => getViewResults(currentView.value).value);
```

### Pattern 2: Full Editor

```typescript
const {
  base,
  source,
  load,
  save,
  hasChanges,
  addItem,
  removeItem,
  updateItem,
  addView,
  removeView,
  addFormula,
  removeFormula,
  state,
} = useBase({
  source: ref([]),
  trackChanges: true,
});

// Load existing
load(yamlString);

// Edit base
addFormula('custom', 'expression');
addView({ type: 'table', name: 'New View', order: ['file.name'] });

// Edit data
addItem({ id: '1', name: 'Item.md', properties: {} });
updateItem('1', { properties: { status: 'done' } });

// Save when needed
if (hasChanges.value) {
  const yaml = save();
  await writeFile('config.base', yaml);
}
```

### Pattern 3: Auto-save

```typescript
const { save, hasChanges } = useBase({
  base: yamlString,
  trackChanges: true,
});

let saveTimeout: NodeJS.Timeout | null = null;

watch(hasChanges, (changed) => {
  if (changed) {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
      const yaml = save();
      await writeFile('config.base', yaml);
      console.log('Auto-saved');
    }, 1000); // Debounce 1 second
  }
});
```

### Pattern 4: Dynamic Configuration

```typescript
const {
  base,
  addItem,
  getViewResults,
  viewNames,
} = useBase({ source: ref([]) });

// User creates view
function createView(name: string, type: ViewType, properties: string[]) {
  base.addTableView(name, { order: properties });
}

// User adds formula
function addCustomFormula(name: string, expr: string) {
  base.addFormula(name, expr);
  // Results automatically update!
}

// User filters data
function applyFilter(filter: string) {
  base.clearFilters();
  base.addFilter(filter);
  // Results automatically re-filter!
}
```

### Pattern 5: Multi-view Dashboard

```typescript
const { getViewResults, viewNames, state } = useBase({
  source: ref(data),
  base: yamlConfig,
});

// Create reactive results for each view
const dashboardViews = computed(() =>
  viewNames.value.map(name => ({
    name,
    results: getViewResults(name).value,
  }))
);

// Display in template
// <div v-for="view in dashboardViews" :key="view.name">
//   <h3>{{ view.name }}</h3>
//   <div>{{ view.results.items.length }} items</div>
// </div>
```

### Pattern 6: Source Synchronization

```typescript
const { source, addItem, updateItem, removeItem } = useBase({
  source: ref([]),
});

// Sync from external source (e.g., file system)
async function syncFromFiles(directory: string) {
  const files = await readDirectory(directory);
  
  for (const file of files) {
    const content = await readFile(file.path);
    const frontmatter = parseFrontmatter(content);
    
    addItem({
      id: file.path,
      name: file.name,
      properties: frontmatter,
      data: { content },
    });
  }
}

// Sync changes back to files
async function syncToFiles() {
  for (const item of source.value) {
    const content = generateMarkdown(item);
    await writeFile(item.id, content);
  }
}
```

### Pattern 7: Batch Operations

```typescript
const { source, setSource } = useBase();

// Batch update all items
function batchUpdate(updater: (item: BaseSource) => BaseSource) {
  setSource(source.value.map(updater));
}

// Example: Mark all as completed
batchUpdate(item => ({
  ...item,
  properties: { ...item.properties, status: 'done' },
}));

// Example: Add tag to all
batchUpdate(item => ({
  ...item,
  tags: [...(item.tags || []), 'archived'],
}));
```

## Best Practices

### 1. Use Change Tracking for Editors

```typescript
const base = useBase({ trackChanges: true });

// Show save indicator
<div v-if="base.hasChanges">● Unsaved changes</div>
```

### 2. Debounce Auto-save

```typescript
// Don't save on every change - debounce!
let timeout: NodeJS.Timeout | null = null;
watch(hasChanges, (changed) => {
  if (changed) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => save(), 1000);
  }
});
```

### 3. Use State for UI

```typescript
const { state } = useBase();

// Conditionally render based on state
<div v-if="state.hasViews">
  <ViewSelector :views="viewNames" />
</div>
<div v-else>
  <EmptyState>No views configured</EmptyState>
</div>
```

### 4. Separate Concerns

```typescript
// Good: Separate concerns
const editor = useBase({ trackChanges: true });  // For editing
const viewer = useBase({ source: editor.source }); // For viewing

// Bad: Don't create multiple instances of same base
const base1 = useBase({ source });
const base2 = useBase({ source }); // Unnecessary duplication
```

### 5. Type Your Data

```typescript
interface MyData {
  title: string;
  description: string;
  tags: string[];
}

const base = useBase<MyData>({
  source: ref<BaseSource<MyData>[]>([]),
});

// Now you get full type safety
base.addItem({
  id: '1',
  name: 'Item.md',
  data: {
    title: 'Title',
    description: 'Description',
    tags: ['tag1'],
  },
});
```

## Common Pitfalls

### ❌ Don't Mutate Source Directly

```typescript
// Bad
source.value[0].properties.status = 'done';

// Good
updateItem(source.value[0].id, {
  properties: { status: 'done' },
});
```

### ❌ Don't Forget to Save

```typescript
// Bad - Changes are lost!
base.addFormula('test', 'expression');
// ... page reload

// Good - Save changes
base.addFormula('test', 'expression');
await writeFile('config.base', save());
```

### ❌ Don't Create Ref Inside useBase

```typescript
// Bad
const { source } = useBase({
  source: ref([]),  // This ref is internal to useBase
});
source.value = []; // OK, but you lose reference

// Good
const mySource = ref([]);
const { source } = useBase({ source: mySource });
// Now mySource and source are the same ref
```

## Performance Tips

1. **Use `trackChanges: false`** for viewers (faster)
2. **Debounce rapid changes** before saving
3. **Use `memo()` for expensive computeds** when dealing with large datasets
4. **Limit result sizes** with view `limit` property
5. **Use virtual scrolling** for large result lists

## Examples

- **Complete Usage**: `examples/use-base-example.ts`
- **Vue Component**: `examples/use-base-vue-component.vue`
- **Auto-save**: See Pattern 3 above
- **Editor**: See Pattern 2 above

## See Also

- [ReactiveBase Documentation](REACTIVE_BASE_SUMMARY.md)
- [Quick Reference](REACTIVE_BASE_QUICK_REF.md)
- [Migration Guide](MIGRATION_GUIDE.md)
- [README](README.md)
