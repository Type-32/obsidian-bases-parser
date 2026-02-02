# Obsidian Bases TypeScript Schema

A complete TypeScript implementation for Obsidian Bases (`.base` files) including schema definitions, lexer, parser, evaluator, and **reactive query system**.

Based on the official Obsidian Bases documentation: https://help.obsidian.md/bases

## Overview

This package provides:

1. **Complete TypeScript Schema** - Type definitions for all Obsidian Bases constructs
2. **Lexer & Parser** - Tokenize and parse filter/formula expressions into AST
3. **Evaluator** - Execute parsed expressions against file/note contexts
4. **Builder APIs** - Fluent interfaces for creating bases and filters
5. **Preset Utilities** - Common filter patterns, formulas, and summaries
6. **YAML Serialization** - Convert base objects to valid YAML
7. **Reactive Query System** - Vue-integrated reactive querying with `useBaseQuery()` composable
8. **YAML Reader** - Parse `.base` files from YAML strings

## Installation

```bash
# Using npm
npm install @type32/obsidian-bases-parser

# Using yarn
yarn add @type32/obsidian-bases-parser

# Using pnpm
pnpm add @type32/obsidian-bases-parser

# Using bun
bun add @type32/obsidian-bases-parser
```

### Dependencies

This package requires:
- `vue` ^3.5.27 - For reactive system
- `js-yaml` ^4.1.1 - For efficient YAML parsing and serialization

## Quick Start

### Creating a Base (Static)

```typescript
import { createBase, PresetFilters, PresetFormulas } from './index';

const myBase = createBase()
  .withFilters(PresetFilters.byTag('project'))
  .addFormula('days_old', PresetFormulas.daysOld())
  .addFormula('status_icon', PresetFormulas.statusIcon())
  .addTableView('Active Projects', {
    order: ['file.name', 'status', 'formula.status_icon'],
    filters: PresetFilters.byStatus('active'),
  })
  .build();
```

### Creating a Reactive Base (Recommended)

```typescript
import { createReactiveBase, PresetFilters, PresetFormulas } from './index';

const myBase = createReactiveBase()
  .addFilter(PresetFilters.byTag('project'))
  .addFormula('days_old', PresetFormulas.daysOld())
  .addFormula('status_icon', PresetFormulas.statusIcon())
  .addTableView('Active Projects', {
    order: ['file.name', 'status', 'formula.status_icon'],
    filters: PresetFilters.byStatus('active'),
  });

// Can be modified later!
myBase.addFormula('priority_label', PresetFormulas.priorityLabel());
myBase.setViewOrder('Active Projects', ['formula.priority_label', 'file.name']);

// Convert to YAML
const yaml = myBase.toYAML();
```

### Parsing and Evaluating Filters

```typescript
import { parseFilter, parseFilterExpression, evaluateFilter, validateFilter } from './index';

// Parse a filter expression into a FilterExpObject with extracted components
const parsed = parseFilterExpression('file.hasTag("book") && status == "reading"');

// Access extracted components for programmatic use
if (parsed.fileMethods.includes('hasTag')) {
  console.log('Tags referenced:', parsed.referencedTags); // ['book']
}

if (parsed.noteProperties.includes('status')) {
  console.log('Filter uses status property');
}

for (const comparison of parsed.comparisons) {
  console.log(`${comparison.left.name} ${comparison.operator} ${comparison.right.raw}`);
}

// Parse into AST (lower-level)
const result = parseFilter('file.hasTag("book") && status == "reading"');

// Evaluate against a context
const context = {
  file: {
    name: 'My Book.md',
    tags: ['book', 'reading'],
    // ... other file properties
  },
  note: {
    status: 'reading',
  },
};

const evaluation = evaluateFilter('file.hasTag("book")', context);
console.log(evaluation); // { type: 'BOOLEAN', value: true }

// Validate a filter
const validation = validateFilter({
  and: ['status == "done"', 'priority > 3'],
});
```

### Serializing to YAML

```typescript
import { serializeToYAML } from './index';

const yaml = serializeToYAML(myBase);
console.log(yaml);
// Output:
// filters:
//   and:
//     - file.hasTag("project")
// formulas:
//   days_old: '((now() - file.ctime) / 86400000).round(0)'
// ...
```

**Note:** YAML parsing and serialization is powered by `js-yaml` for robust, efficient, and standards-compliant handling of YAML files.

## Schema Overview

### Filter System

Filters can be:
- **Simple expressions**: `'status == "done"'`
- **Filter objects**: `{ and: [...], or: [...], not: [...] }`
- **Nested combinations**: Complex boolean logic

```typescript
import { Filter, FilterObject } from './index';

const simpleFilter: Filter = 'status == "done"';

const complexFilter: Filter = {
  or: [
    'file.hasTag("important")',
    {
      and: [
        'priority >= 3',
        {
          not: ['file.hasTag("archived")'],
        },
      ],
    },
  ],
};
```

### View System

Views define how data is displayed:

```typescript
import { View, TableView, CardsView, ListView, MapView } from './index';

const tableView: TableView = {
  type: 'table',
  name: 'My Table',
  order: ['file.name', 'status', 'due'],
  filters: { and: ['status != "done"'] },
  groupBy: { property: 'status', direction: 'ASC' },
  summaries: { priority: 'Average' },
  sort: [
    { property: 'file.name', direction: 'ASC' },
    { property: 'due', direction: 'DESC' },
  ],
  columnSize: {
    'file.name': 300,
    'status': 150,
  },
};

const cardsView: CardsView = {
  type: 'cards',
  name: 'Project Cards',
  order: ['priority', 'file.name'],
  cardSize: 250,
  image: 'cover',
  imageFit: 'cover',
  imageAspectRatio: 1.4,
};
```

#### Extended View Properties

**Table Views:**
- `sort` - Separate sorting configuration (different from display order)
- `columnSize` - Column width configuration (property name to width in pixels)

**Cards Views:**
- `cardSize` - Card dimensions in pixels
- `image` - Image source (`'cover'`, `'first'`, or property name)
- `imageFit` - Image fitting mode (`'cover'`, `'contain'`, `'fill'`, or `''`)
- `imageAspectRatio` - Image aspect ratio (number)

### Formula System

Formulas compute values from properties:

```typescript
import { Formulas } from './index';

const formulas: Formulas = {
  days_until_due: 'if(due, ((date(due) - today()) / 86400000).round(0), "")',
  is_overdue: 'if(due, date(due) < today() && status != "done", false)',
  priority_label: 'if(priority == 1, "🔴 High", if(priority == 2, "🟡 Medium", "🟢 Low"))',
};
```

## Parser Features

The parser supports all Obsidian Bases syntax:

### Operators
- **Comparison**: `==`, `!=`, `>`, `<`, `>=`, `<=`
- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Boolean**: `&&`, `||`, `!`

### Literals
- **Strings**: `"hello"`, `'world'`
- **Numbers**: `42`, `3.14`
- **Booleans**: `true`, `false`
- **Durations**: `"1d"`, `"2h"`, `"3w"`
- **Regular Expressions**: `/pattern/flags`

### Property Access
- **Dot notation**: `file.name`, `note.status`
- **Bracket notation**: `properties["key"]`, `tags[0]`
- **Prefixed**: `file.*`, `note.*`, `formula.*`, `this.*`

### Function Calls
- **Global**: `now()`, `today()`, `date("2024-01-01")`
- **Method**: `file.hasTag("tag")`, `string.contains("sub")`
- **Chained**: `file.ctime.format("YYYY-MM-DD")`

### Special Syntax
- **Conditional**: `if(condition, trueValue, falseValue)`
- **Date arithmetic**: `now() + "1d"`, `today() - "1w"`

## Preset Utilities

### Filters

```typescript
import { PresetFilters } from './index';

PresetFilters.byTag('project');           // 'file.hasTag("project")'
PresetFilters.byExtension('md');          // 'file.ext == "md"'
PresetFilters.inFolder('Notes');          // 'file.inFolder("Notes")'
PresetFilters.modifiedWithin(7);          // 'file.mtime > now() - "7d"'
PresetFilters.byProperty('status', 'active'); // 'status == "active"'
```

### Formulas

```typescript
import { PresetFormulas } from './index';

PresetFormulas.daysUntilDue();            // Days until due date
PresetFormulas.isOverdue();               // Check if overdue
PresetFormulas.lastModified();            // Relative modification time
PresetFormulas.priorityLabel();           // Priority with icons
PresetFormulas.statusIcon();              // Status with icons
PresetFormulas.formatCurrency('price');   // Format as currency
```

### Summaries

```typescript
import { PresetSummaries } from './index';

PresetSummaries.customAverage(2);         // Average with rounding
PresetSummaries.countFilled();            // Count non-empty values
PresetSummaries.percentTrue();            // Percentage of true values
PresetSummaries.uniqueJoin(', ');         // Join unique values
```

## Builder APIs

### Base Builder

```typescript
import { createBase } from './index';

const base = createBase()
  .withFilters({ and: ['file.hasTag("task")'] })
  .addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)')
  .configureProperty('status', { displayName: 'Status' })
  .addTableView('Active Tasks', {
    order: ['file.name', 'status'],
    filters: { and: ['status != "done"'] },
  })
  .addCardsView('Task Cards', {
    order: ['file.name', 'status'],
  })
  .build();
```

### Filter Builder

```typescript
import { createFilter, and, or, not } from './index';

const filter = createFilter()
  .and('file.hasTag("project")')
  .and('file.ext == "md"')
  .not('file.hasTag("archived")')
  .build();

// Or start with a specific operator
const filter2 = and(
  'file.hasTag("important")',
  or('priority == 1', 'priority == 2')
);
```

## Complete Base Example

```typescript
import {
  createBase,
  PresetFilters,
  PresetFormulas,
  serializeToYAML,
} from './index';

const taskBase = createBase()
  .withFilters(
    and(
      PresetFilters.byTag('task'),
      PresetFilters.byExtension('md')
    )
  )
  .addFormula('days_until_due', PresetFormulas.daysUntilDue())
  .addFormula('is_overdue', PresetFormulas.isOverdue())
  .addFormula('priority_label', PresetFormulas.priorityLabel())
  .configureProperty('formula.days_until_due', { displayName: 'Days Left' })
  .addTableView('Active Tasks', {
    order: ['file.name', 'formula.priority_label', 'due'],
    filters: not(PresetFilters.byStatus('done')),
    groupBy: { property: 'status', direction: 'ASC' },
  })
  .addTableView('Completed Tasks', {
    order: ['completed_date', 'file.name'],
    filters: PresetFilters.byStatus('done'),
  })
  .build();

console.log(serializeToYAML(taskBase));
```

## File Structure

```
obsidian-bases-parser/
├── src/
│   ├── index.ts                    # Main exports
│   ├── obsidian-bases-schema.ts    # Type definitions
│   ├── obsidian-bases-parser.ts    # Lexer, parser, evaluator
│   ├── obsidian-bases-utils.ts     # Builders, presets, serialization
│   ├── obsidian-bases-reactive.ts  # Reactive system (Vue + ReactiveBase)
│   └── obsidian-bases-example.ts   # Usage examples
├── examples/
│   ├── reactive-base-example.ts    # Comprehensive reactive base examples
│   └── simple-reactive-demo.ts     # Simple demonstration
├── llms.txt                        # LLM overview
├── llms-full.txt                   # Complete LLM documentation
└── README.md                       # This file
```

## API Reference

### Schema Types

| Type | Description |
|------|-------------|
| `ObsidianBase` | Complete base file structure |
| `Filter` | Filter expression or filter object |
| `FilterObject` | Recursive and/or/not filter structure |
| `FilterExpObject` | Parsed filter with extracted components |
| `PropertyReference` | Property reference with prefix and name |
| `FunctionCall` | Function call with name and arguments |
| `ComparisonOperation` | Comparison with operator and operands |
| `View` | View configuration (table, cards, list, map) |
| `Formulas` | Formula definitions |
| `Properties` | Property display configurations |
| `Summaries` | Custom summary formulas |

### FilterExpObject Properties

When you parse a filter expression using `parseFilterExpression()`, you get a `FilterExpObject` with these accessible properties:

| Property | Type | Description |
|----------|------|-------------|
| `raw` | `string` | The original filter expression |
| `expressionType` | `ExpressionType` | Type: 'comparison', 'boolean', 'function_call', etc. |
| `ast` | `ASTExpression` | The parsed AST |
| `properties` | `PropertyReference[]` | All property references |
| `functionCalls` | `FunctionCall[]` | All function calls |
| `comparisons` | `ComparisonOperation[]` | All comparison operations |
| `literals` | `LiteralValue[]` | All literal values |
| `hasBooleanOperators` | `boolean` | Has `&&`, `\|\|`, or `!` |
| `hasDateArithmetic` | `boolean` | Has date arithmetic like `now() - "7d"` |
| `usesThisReference` | `boolean` | Uses `this` keyword |
| `fileMethods` | `string[]` | File methods used (e.g., 'hasTag', 'inFolder') |
| `noteProperties` | `string[]` | Note properties referenced |
| `fileProperties` | `string[]` | File properties referenced |
| `formulaProperties` | `string[]` | Formula properties referenced |
| `referencedTags` | `string[]` | Tags from `file.hasTag()` calls |
| `referencedFolders` | `string[]` | Folders from `file.inFolder()` calls |
| `isValid` | `boolean` | Whether parsing succeeded |
| `errors` | `string[]` | Parse errors if any |

### Parser Classes

| Class | Description |
|-------|-------------|
| `Lexer` | Tokenizes expressions into tokens |
| `Parser` | Builds AST from tokens |
| `Evaluator` | Executes AST against context |
| `FilterObjectParser` | Parses recursive filter objects |
| `FilterExpressionParser` | Parses filter strings into FilterExpObject |
| `Validator` | Validates filter/formula syntax |

### Builder Classes

| Class | Description |
|-------|-------------|
| `BaseBuilder` | Fluent API for creating bases |
| `FilterBuilder` | Fluent API for building filters |

### Utility Functions

| Function | Description |
|----------|-------------|
| `createBase()` | Create a new base builder |
| `createFilter()` | Create a new filter builder |
| `parseFilter()` | Parse a filter to AST |
| `parseFilterExpression()` | Parse filter to FilterExpObject with components |
| `parseFormula()` | Parse a formula to AST |
| `evaluateFilter()` | Evaluate a filter against context |
| `evaluateFormula()` | Evaluate a formula against context |
| `validateFilter()` | Validate filter syntax |
| `validateFormula()` | Validate formula syntax |
| `serializeToYAML()` | Convert base to YAML |
| `readBase()` | Parse YAML string into ObsidianBase |

### Reactive System (Vue Integration)

| Class/Function | Description |
|----------------|-------------|
| `ReactiveBase` | Reactive base object with modification methods |
| `ReactiveBaseQuery` | Reactive query class with automatic re-evaluation |
| `useBase()` | **Unified composable for complete base management** |
| `useBaseQuery()` | Vue composable for reactive queries |
| `useBaseView()` | Vue composable for single view queries |
| `createReactiveBase()` | Create a new ReactiveBase instance |
| `createReactiveBaseFromYAML()` | Create a ReactiveBase from YAML string |
| `createBaseQuery()` | Create a ReactiveBaseQuery instance |
| `createBaseQueryFromYAML()` | Create a query from YAML string |

## Reactive Query System

The reactive query system integrates with Vue's reactivity system to provide automatic updates when source data changes.

### Reactive Base Object

The `ReactiveBase` class provides a reactive, modifiable base configuration with methods to adjust filters, views, formulas, and more in real-time.

```typescript
import { createReactiveBase, ReactiveBaseQuery } from './index';

// Create a reactive base
const base = createReactiveBase();

// Add filters dynamically
base.addFilter('file.hasTag("task")');
base.addFilter('status != "done"');

// Add formulas
base.addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)');

// Add views
base.addTableView('Active Tasks', {
  order: ['file.name', 'formula.days_old'],
  filters: 'priority > 2',
});

// Use with reactive query
const query = new ReactiveBaseQuery(source, base.ref);
const results = query.getViewResults('Active Tasks');

// Modify the base - results automatically update!
base.setViewFilters('Active Tasks', 'priority > 1');
base.addFormula('priority_label', 'if(priority == 1, "High", "Low")');
base.setViewOrder('Active Tasks', ['formula.priority_label', 'file.name']);

// Convert to YAML for saving
const yaml = base.toYAML();
```

### ReactiveBase API

The `ReactiveBase` class provides comprehensive methods for modifying base configurations:

#### Filters
- `setFilters(filters)` - Replace all global filters
- `addFilter(expression)` - Add a filter (AND with existing)
- `clearFilters()` - Remove all global filters

#### Formulas
- `addFormula(name, expression)` - Add or update a formula
- `removeFormula(name)` - Remove a formula
- `setFormulas(formulas)` - Replace all formulas
- `clearFormulas()` - Remove all formulas

#### Properties
- `configureProperty(name, config)` - Configure property display settings
- `removePropertyConfig(name)` - Remove property configuration
- `setProperties(properties)` - Replace all property configurations
- `clearProperties()` - Remove all property configurations

#### Summaries
- `addSummary(name, expression)` - Add or update a custom summary
- `removeSummary(name)` - Remove a summary
- `setSummaries(summaries)` - Replace all summaries
- `clearSummaries()` - Remove all summaries

#### Views
- `addView(view)` - Add a view
- `addTableView(name, options)` - Add a table view
- `addCardsView(name, options)` - Add a cards view
- `addListView(name, options)` - Add a list view
- `addMapView(name, options)` - Add a map view
- `removeView(name)` - Remove a view by name
- `updateView(name, updater)` - Update a view by name
- `getView(name)` - Get a view configuration
- `setViewFilters(viewName, filters)` - Update view filters
- `setViewOrder(viewName, order)` - Update view order
- `setViewLimit(viewName, limit)` - Update view limit
- `setViewGroupBy(viewName, groupBy)` - Update view grouping
- `clearViews()` - Remove all views

#### Utility Methods
- `toYAML()` - Convert to YAML string
- `fromYAML(yaml)` - Load from YAML string
- `clone()` - Create a copy of the base
- `reset()` - Reset to empty base
- `toObject()` - Get plain object (non-reactive copy)

### Dynamic Base Modifications

The key advantage of `ReactiveBase` is that all modifications are reactive and automatically propagate to any `ReactiveBaseQuery` instances using it:

```typescript
import { ref } from 'vue';
import { createReactiveBase, ReactiveBaseQuery, BaseSource } from './index';

const source = ref<BaseSource[]>([/* your data */]);
const base = createReactiveBase();

// Initial setup
base.addFilter('file.hasTag("project")')
    .addTableView('Projects', { order: ['file.name'] });

// Create query
const query = new ReactiveBaseQuery(source, base.ref);
const results = query.getViewResults('Projects');

// Later: Add a new formula
base.addFormula('status_icon', 'if(status == "done", "✅", "⏳")');

// Update view to use new formula
base.setViewOrder('Projects', ['formula.status_icon', 'file.name']);

// Results automatically update with new formula and ordering!
console.log(results.value.items);

// Later: Change filters
base.clearFilters();
base.addFilter('file.hasTag("active-project")');

// Results automatically re-filter!
console.log(results.value.items);
```

### Loading from YAML

You can create a reactive base from existing YAML:

```typescript
import { createReactiveBaseFromYAML } from './index';

const yaml = `
filters:
  and:
    - file.hasTag("task")
formulas:
  days_old: '((now() - file.ctime) / 86400000).round(0)'
views:
  - type: table
    name: "Tasks"
    order:
      - file.name
`;

const base = createReactiveBaseFromYAML(yaml);

// Now modify it
base.addFormula('priority_label', 'if(priority == 1, "High", "Low")');
base.addTableView('High Priority', {
  filters: 'priority == 1',
  order: ['file.name'],
});

// Save back to YAML
const updatedYaml = base.toYAML();
```

### Builder Pattern vs Reactive Base

#### Static Builder (Old Approach)

```typescript
import { createBase } from './index';

// Build once
const base = createBase()
  .addFilter('file.hasTag("task")')
  .addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)')
  .addTableView('Tasks', { order: ['file.name'] })
  .build(); // Returns a plain object

// ❌ Cannot modify after build
// You would need to rebuild from scratch

// Use with query
const query = new ReactiveBaseQuery(source, base);
```

#### Reactive Base (New Approach)

```typescript
import { createReactiveBase } from './index';

// Create reactive base
const base = createReactiveBase()
  .addFilter('file.hasTag("task")')
  .addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)')
  .addTableView('Tasks', { order: ['file.name'] });
// No .build() needed - stays reactive!

// ✅ Can modify anytime
base.addFormula('priority_label', 'if(priority == 1, "High", "Low")');
base.setViewOrder('Tasks', ['formula.priority_label', 'file.name']);

// Use with query - changes propagate automatically
const query = new ReactiveBaseQuery(source, base.ref);
const results = query.getViewResults('Tasks');

// Modifications automatically update results!
base.setViewFilters('Tasks', 'status != "done"');
console.log(results.value.items); // Automatically filtered!
```

#### Key Differences

| Feature | Static Builder | Reactive Base |
|---------|---------------|---------------|
| Modification | ❌ Immutable after `.build()` | ✅ Fully mutable |
| Reactivity | ❌ No automatic updates | ✅ Automatic updates |
| YAML Export | ✅ Via `serializeToYAML()` | ✅ Via `.toYAML()` |
| YAML Import | ✅ Via `readBase()` | ✅ Via `.fromYAML()` |
| Use Case | Static configurations | Dynamic, real-time updates |
| Return Type | Plain `ObsidianBase` object | `ReactiveBase` instance |

**Recommendation:** Use `ReactiveBase` when you need dynamic configuration changes, especially in interactive applications. Use the static builder when you have fixed configurations that won't change.

## Reactive Query System

The reactive query system integrates with Vue's reactivity system to provide automatic updates when source data changes.

### Basic Usage

```typescript
import { ref } from 'vue';
import { readBase, useBaseQuery, BaseSource } from './index';

// Define your data type
interface Task {
  title: string;
  assignee: string;
}

// Create reactive source
const source = ref<BaseSource<Task>[]>([
  {
    id: '1',
    name: 'Task 1.md',
    basename: 'Task 1',
    tags: ['task', 'urgent'],
    properties: { status: 'todo', priority: 1 },
    data: { title: 'Complete docs', assignee: 'Alice' },
  },
  // ... more items
]);

// Read base from YAML
const yaml = `
filters:
  and:
    - file.hasTag("task")
formulas:
  priority_label: 'if(priority == 1, "🔴 High", "🟡 Medium")'
views:
  - type: table
    name: "Active Tasks"
    filters:
      and:
        - status != "done"
    order: [file.name, formula.priority_label]
`;

const base = readBase(yaml);

// Create reactive query
const { getViewResults, source: reactiveSource } = useBaseQuery(source, base);

// Get reactive results
const activeTasks = getViewResults('Active Tasks');

// Access in template or computed
// activeTasks.value.items - filtered, sorted items
// activeTasks.value.totalCount - total before limit
// activeTasks.value.groups - grouped items (if groupBy specified)
// activeTasks.value.summaries - calculated summaries
```

### Vue Component Example

```vue
<template>
  <div>
    <h1>Tasks ({{ taskCount }})</h1>
    <ul>
      <li v-for="task in tasks" :key="task.id">
        {{ task.properties?.priority_label }} - {{ task.data?.title }}
      </li>
    </ul>
    <button @click="addTask">Add Task</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useBaseView, readBase, BaseSource } from './index';

interface Task {
  title: string;
}

const source = ref<BaseSource<Task>[]>([/* ... */]);

const base = readBase(`
  formulas:
    priority_label: 'if(priority == 1, "🔴", "🟢")'
  views:
    - type: list
      name: "Tasks"
      order: [formula.priority_label]
`);

// useBaseView returns ComputedRefs that auto-update
const { items: tasks, totalCount: taskCount } = useBaseView(
  source,
  base,
  'Tasks'
);

function addTask() {
  source.value.push({
    id: String(Date.now()),
    name: 'New Task.md',
    properties: { priority: 1 },
    data: { title: 'New Task' },
  });
  // tasks and taskCount automatically update!
}
</script>
```

### useBase() - Unified Base Management

The `useBase()` composable provides a complete, unified interface for managing an entire base instance reactively. It combines base configuration, source data management, and querying into one convenient API.

```typescript
import { ref } from 'vue';
import { useBase, BaseSource } from './index';

interface Task {
  title: string;
  description: string;
}

const {
  // Base & State
  base,
  isLoaded,
  hasChanges,
  state,
  
  // Load/Save
  load,
  save,
  
  // Source Management
  source,
  addItem,
  updateItem,
  removeItem,
  
  // Query Access
  getViewResults,
  viewNames,
  
  // Shortcuts
  addView,
  addFormula,
  setFilters,
} = useBase<Task>({
  source: ref([]),
  trackChanges: true,
});

// Load from YAML
load(yamlString);

// Modify base
addFormula('priority_label', 'if(priority == 1, "High", "Low")');
addView({ type: 'table', name: 'Tasks', order: ['file.name'] });

// Add data
addItem({
  id: '1',
  name: 'Task.md',
  properties: { status: 'todo' },
  data: { title: 'My Task', description: 'Details' },
});

// Query
const tasks = getViewResults('Tasks');
console.log(tasks.value.items);

// Save
const yaml = save();
```

#### Features

- **Unified API** - One composable for everything
- **Reactive** - All changes propagate automatically
- **Change Tracking** - Know when there are unsaved changes
- **Source Management** - CRUD operations on source data
- **Full Query Access** - All reactive query features
- **Load/Save** - YAML import/export
- **State & Statistics** - View counts, item counts, etc.

#### Auto-save Pattern

```typescript
const { save, hasChanges } = useBase({
  base: yamlString,
  trackChanges: true,
});

// Implement auto-save with debouncing
let saveTimeout: NodeJS.Timeout | null = null;

watch(hasChanges, (changed) => {
  if (changed) {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
      const yaml = save();
      await writeFile('config.base', yaml);
    }, 1000); // Save after 1s of no changes
  }
});
```

See `examples/use-base-example.ts` and `examples/use-base-vue-component.vue` for complete examples.

### Using ReactiveBaseQuery Class

```typescript
import { ref } from 'vue';
import { ReactiveBaseQuery, readBase, BaseSource } from './index';

const source = ref<BaseSource[]>([/* ... */]);
const base = readBase(yamlString);

// Create query instance
const query = new ReactiveBaseQuery(source, base, { debug: true });

// Get computed results for different views
const tableResults = query.getViewResults('Table View');
const cardResults = query.getViewResults('Card View');

// Access reactive data
console.log(tableResults.value.items);
console.log(tableResults.value.totalCount);
console.log(tableResults.value.summaries);

// Update source - results auto-update
query.setSource([...newItems]);

// Or update base - results auto-update
query.setBase(newBase);

// Force refresh
query.refresh();
```

### BaseSource Type

The `BaseSource<T>` type is flexible and allows custom data:

```typescript
interface BaseSource<T = void> {
  // Obsidian-specific fields (all optional)
  id?: string;
  name?: string;           // File name (e.g., "My Note.md")
  basename?: string;       // Without extension (e.g., "My Note")
  path?: string;           // Full path (e.g., "Notes/My Note.md")
  folder?: string;         // Parent folder (e.g., "Notes")
  ext?: string;            // Extension (e.g., "md")
  size?: number;           // File size in bytes
  ctime?: Date | string;   // Created time
  mtime?: Date | string;   // Modified time
  tags?: string[];         // Tags
  links?: string[];        // Internal links
  backlinks?: string[];    // Backlinks
  embeds?: string[];       // Embeds
  properties?: Record<string, unknown>;  // Frontmatter properties

  // Your custom data
  data?: T;
}
```

### Custom Formula Functions

```typescript
const query = new ReactiveBaseQuery(source, base, {
  customFunctions: {
    calculateScore: (priority: number, complexity: number) => {
      return priority * complexity * 10;
    },
    formatDate: (date: Date, format: string) => {
      // Your date formatting logic
      return formattedDate;
    },
  },
});
```

## License

MIT

## References

- [Obsidian Bases Documentation](https://help.obsidian.md/bases)
- [Bases Syntax](https://help.obsidian.md/bases/syntax)
- [Functions](https://help.obsidian.md/bases/functions)
- [Formulas](https://help.obsidian.md/formulas)
