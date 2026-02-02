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
# Copy the files to your project
cp obsidian-bases-schema.ts obsidian-bases-parser.ts obsidian-bases-utils.ts obsidian-bases-example.ts index.ts your-project/
```

## Quick Start

### Creating a Base

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
};
```

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
obsidian-bases/
├── index.ts                    # Main exports
├── obsidian-bases-schema.ts    # Type definitions
├── obsidian-bases-parser.ts    # Lexer, parser, evaluator
├── obsidian-bases-utils.ts     # Builders, presets, serialization
├── obsidian-bases-reactive.ts  # Reactive query system (Vue)
├── obsidian-bases-example.ts   # Usage examples
├── llms.txt                    # LLM overview
├── llms-full.txt               # Complete LLM documentation
└── README.md                   # This file
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

### Reactive Query (Vue Integration)

| Class/Function | Description |
|----------------|-------------|
| `ReactiveBaseQuery` | Reactive query class with automatic re-evaluation |
| `useBaseQuery()` | Vue composable for reactive queries |
| `useBaseView()` | Vue composable for single view queries |
| `createBaseQuery()` | Create a ReactiveBaseQuery instance |
| `createBaseQueryFromYAML()` | Create a query from YAML string |

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
