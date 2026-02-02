/**
 * Obsidian Bases Examples
 *
 * This file demonstrates how to use the Obsidian Bases TypeScript schema
 * and parser with real-world examples.
 */

import {
  ObsidianBase,
  Filter,
  ExecutionContext,
  FileContext,
  BaseSource,
} from './obsidian-bases-schema';

import {
  Lexer,
  Parser,
  Evaluator,
  FilterObjectParser,
  FilterExpressionParser,
  Validator,
  parseFilter,
  parseFilterExpression,
  parseFormula,
  evaluateFilter,
  evaluateFormula,
  validateFilter,
  validateFormula,
} from './obsidian-bases-parser';

import {
  BaseBuilder,
  FilterBuilder,
  PresetFilters,
  PresetFormulas,
  PresetSummaries,
  createBase,
  createFilter,
  and,
  or,
  not,
  serializeToYAML,
} from './obsidian-bases-utils';

import {
  ReactiveBaseQuery,
  useBaseQuery,
  useBaseView,
  readBase,
  createBaseQuery,
  createBaseQueryFromYAML,
} from './obsidian-bases-reactive';

import { ref, computed } from 'vue';

// =============================================================================
// EXAMPLE 1: Task Tracker Base
// =============================================================================

export const taskTrackerBase: ObsidianBase = {
  filters: {
    and: [
      'file.hasTag("task")',
      'file.ext == "md"',
    ],
  },
  formulas: {
    days_until_due: 'if(due, ((date(due) - today()) / 86400000).round(0), "")',
    is_overdue: 'if(due, date(due) < today() && status != "done", false)',
    priority_label: 'if(priority == 1, "🔴 High", if(priority == 2, "🟡 Medium", "🟢 Low"))',
  },
  properties: {
    status: { displayName: 'Status' },
    'formula.days_until_due': { displayName: 'Days Until Due' },
    'formula.priority_label': { displayName: 'Priority' },
  },
  views: [
    {
      type: 'table',
      name: 'Active Tasks',
      filters: {
        and: ['status != "done"'],
      },
      order: [
        'file.name',
        'status',
        'formula.priority_label',
        'due',
        'formula.days_until_due',
      ],
      groupBy: {
        property: 'status',
        direction: 'ASC',
      },
      summaries: {
        'formula.days_until_due': 'Average',
      },
    },
    {
      type: 'table',
      name: 'Completed',
      filters: {
        and: ['status == "done"'],
      },
      order: [
        'file.name',
        'completed_date',
      ],
    },
  ],
};

// =============================================================================
// EXAMPLE 2: Reading List Base (using builder)
// =============================================================================

export const readingListBase = createBase()
  .withFilters(
    or(
      'file.hasTag("book")',
      'file.hasTag("article")'
    )
  )
  .addFormula('reading_time', 'if(pages, (pages * 2).toString() + " min", "")')
  .addFormula('status_icon', 'if(status == "reading", "📖", if(status == "done", "✅", "📚"))')
  .addFormula('year_read', 'if(finished_date, date(finished_date).year, "")')
  .configureProperty('author', { displayName: 'Author' })
  .configureProperty('formula.status_icon', { displayName: '' })
  .configureProperty('formula.reading_time', { displayName: 'Est. Time' })
  .addCardsView('Library', {
    order: ['cover', 'file.name', 'author', 'formula.status_icon'],
    filters: not('status == "dropped"'),
  })
  .addTableView('Reading List', {
    order: ['file.name', 'author', 'pages', 'formula.reading_time'],
    filters: and('status == "to-read"'),
  })
  .build();

// =============================================================================
// EXAMPLE 3: Project Notes Base (using presets)
// =============================================================================

export const projectNotesBase = createBase()
  .withFilters(
    and(
      PresetFilters.inFolder('Projects'),
      PresetFilters.byExtension('md')
    )
  )
  .addFormula('last_updated', PresetFormulas.lastModified())
  .addFormula('link_count', PresetFormulas.linkCount())
  .addSummary('avgLinks', PresetSummaries.customAverage(1))
  .configureProperty('formula.last_updated', { displayName: 'Updated' })
  .configureProperty('formula.link_count', { displayName: 'Links' })
  .addTableView('All Projects', {
    order: ['file.name', 'status', 'formula.last_updated', 'formula.link_count'],
    summaries: { 'formula.link_count': 'avgLinks' },
    groupBy: { property: 'status', direction: 'ASC' },
  })
  .addListView('Quick List', {
    order: ['file.name', 'status'],
  })
  .build();

// =============================================================================
// EXAMPLE 4: Daily Notes Index
// =============================================================================

export const dailyNotesBase: ObsidianBase = {
  filters: {
    and: [
      'file.inFolder("Daily Notes")',
      '/^\\d{4}-\\d{2}-\\d{2}$/.matches(file.basename)',
    ],
  },
  formulas: {
    word_estimate: '(file.size / 5).round(0)',
    day_of_week: 'date(file.basename).format("dddd")',
  },
  properties: {
    'formula.day_of_week': { displayName: 'Day' },
    'formula.word_estimate': { displayName: '~Words' },
  },
  views: [
    {
      type: 'table',
      name: 'Recent Notes',
      limit: 30,
      order: [
        'file.name',
        'formula.day_of_week',
        'formula.word_estimate',
        'file.mtime',
      ],
    },
  ],
};

// =============================================================================
// EXAMPLE 5: Complex Filter with Nested Logic
// =============================================================================

export const complexFilter: Filter = {
  or: [
    'file.hasTag("important")',
    {
      and: [
        'priority >= 3',
        'status == "active"',
        {
          not: [
            'file.hasTag("archived")',
            'file.inFolder("Archive")',
          ],
        },
      ],
    },
    {
      and: [
        'file.mtime > now() - "7d"',
        'file.hasTag("recent")',
      ],
    },
  ],
};

// =============================================================================
// EXAMPLE 6: Using Filter Builder
// =============================================================================

export const builtFilter = createFilter()
  .and(PresetFilters.byTag('project'))
  .and(PresetFilters.byExtension('md'))
  .and(PresetFilters.modifiedWithin(30))
  .not(PresetFilters.byTag('archived'))
  .build();

// =============================================================================
// EXAMPLE 7: Parser Usage
// =============================================================================

// Tokenize an expression
const expression = 'file.hasTag("book") && status == "reading"';
const lexer = new Lexer(expression);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens);

// Parse into AST
const parser = new Parser(tokens);
const parseResult = parser.parse();
console.log('Parse result:', parseResult);

// =============================================================================
// EXAMPLE 7b: FilterExpObject Usage
// =============================================================================

// Parse a filter expression into a FilterExpObject with extracted components
const filterExp = parseFilterExpression('file.hasTag("book") && status == "reading"');

// Check if the filter uses specific file methods
if (filterExp.fileMethods.includes('hasTag')) {
  console.log('Tags referenced:', filterExp.referencedTags); // ['book']
}

// Check if specific properties are used
if (filterExp.noteProperties.includes('status')) {
  console.log('Filter uses status property');
}

// Access comparison operations
for (const comparison of filterExp.comparisons) {
  console.log(`Comparison: ${comparison.left.name} ${comparison.operator} ${comparison.right.raw}`);
  // Output: "status == reading"
}

// Check expression type
if (filterExp.expressionType === 'boolean') {
  console.log('This is a boolean expression with && or ||');
}

// Access all properties
console.log('File properties:', filterExp.fileProperties); // []
console.log('Note properties:', filterExp.noteProperties); // ['status']
console.log('Formula properties:', filterExp.formulaProperties); // []

// Check for date arithmetic
const dateFilter = parseFilterExpression('file.mtime > now() - "7d"');
if (dateFilter.hasDateArithmetic) {
  console.log('Filter uses date arithmetic');
}

// More complex example
const complexExp = parseFilterExpression('priority > 3 && file.inFolder("Projects") && !file.hasTag("archived")');

// Use in conditional logic
if (complexExp.fileMethods.includes('inFolder')) {
  console.log('Folders referenced:', complexExp.referencedFolders); // ['Projects']
}

if (complexExp.hasBooleanOperators) {
  console.log('Has boolean operators');
}

if (complexExp.usesThisReference) {
  console.log('Uses "this" reference');
}

// =============================================================================
// EXAMPLE 8: Evaluator Usage
// =============================================================================

// Create execution context
const mockFile: FileContext = {
  name: 'My Note.md',
  basename: 'My Note',
  path: 'Notes/My Note.md',
  folder: 'Notes',
  ext: 'md',
  size: 1024,
  ctime: new Date('2024-01-15'),
  mtime: new Date('2024-01-20'),
  tags: ['book', 'reading'],
  links: ['[[Other Note]]'],
  backlinks: [],
  embeds: [],
  properties: {
    status: 'reading',
    priority: 2,
  },
};

const context: ExecutionContext = {
  file: mockFile,
  note: {
    status: 'reading',
    priority: 2,
    due: '2024-02-01',
  },
  formula: {},
};

// Evaluate a filter
const filterResult = evaluateFilter('file.hasTag("book")', context);
console.log('Filter result:', filterResult); // { type: 'BOOLEAN', value: true }

// Evaluate a formula
const formulaResult = evaluateFormula('priority * 10', context);
console.log('Formula result:', formulaResult); // { type: 'NUMBER', value: 20 }

// =============================================================================
// EXAMPLE 9: Validation
// =============================================================================

// Validate a filter
const filterValidation = validateFilter({
  and: ['status == "done"', 'priority > 3'],
});
console.log('Filter validation:', filterValidation);

// Validate a formula
const formulaValidation = validateFormula('if(done, "Yes", "No")');
console.log('Formula validation:', formulaValidation);

// =============================================================================
// EXAMPLE 10: YAML Serialization
// =============================================================================

// Serialize a base to YAML
const yamlOutput = serializeToYAML(taskTrackerBase);
console.log('YAML Output:');
console.log(yamlOutput);

// =============================================================================
// EXAMPLE 11: Advanced Formula Examples
// =============================================================================

export const advancedFormulas = {
  // Date arithmetic
  daysOld: '((now() - file.ctime) / 86400000).round(0)',
  nextWeek: 'today() + "7d"',
  lastMonth: 'now() - "1M"',

  // Conditional with multiple branches
  statusColor: 'if(status == "done", "green", if(status == "in-progress", "yellow", "red"))',

  // String manipulation
  displayName: 'file.basename.title()',
  truncated: 'description.slice(0, 50) + "..."',

  // List operations
  tagCount: 'file.tags.length',
  firstTag: 'file.tags[0]',

  // Complex calculations
  progressPercent: '(completed / total * 100).round(1) + "%"',

  // Using file methods
  hasRequiredTag: 'file.hasTag("required") || file.hasTag("mandatory")',
  inActiveFolder: 'file.inFolder("Active") && !file.inFolder("Active/Archive")',

  // Regular expressions
  isDailyNote: '/^\\d{4}-\\d{2}-\\d{2}$/.matches(file.basename)',
  containsLink: '/\\[\\[.+\\]\\]/.matches(file.content)',
};

// =============================================================================
// EXAMPLE 12: Complete Base with All Features
// =============================================================================

export const completeBase: ObsidianBase = {
  // Global filters
  filters: {
    and: [
      'file.ext == "md"',
      'file.hasTag("note")',
      {
        not: [
          'file.hasTag("template")',
          'file.hasTag("archive")',
        ],
      },
    ],
  },

  // Formula properties
  formulas: {
    age_days: '((now() - file.ctime) / 86400000).round(0)',
    modified_ago: 'file.mtime.relative()',
    is_recent: 'file.mtime > now() - "7d"',
    word_estimate: '(file.size / 5).round(0)',
    tag_summary: 'file.tags.join(", ")',
    link_count: 'file.links.length',
    backlink_count: 'file.backlinks.length',
    priority_icon: 'if(priority == 1, "🔴", if(priority == 2, "🟡", if(priority == 3, "🟢", "⚪")))',
    status_badge: 'if(status == "done", "✅ Done", if(status == "in-progress", "🔄 In Progress", "⏳ Todo"))',
  },

  // Property configurations
  properties: {
    status: { displayName: 'Status' },
    priority: { displayName: 'Priority' },
    due: { displayName: 'Due Date' },
    'formula.age_days': { displayName: 'Age (days)' },
    'formula.modified_ago': { displayName: 'Last Modified' },
    'formula.word_estimate': { displayName: '~Words' },
    'formula.tag_summary': { displayName: 'Tags' },
    'formula.priority_icon': { displayName: '' },
    'formula.status_badge': { displayName: 'Status' },
  },

  // Custom summaries
  summaries: {
    avgAge: 'values.filter(v => v.isType("number")).mean().round(1)',
    totalWords: 'values.filter(v => v.isType("number")).sum()',
    uniqueTags: 'values.flat().unique().length',
  },

  // Views
  views: [
    {
      type: 'table',
      name: 'All Notes',
      order: [
        'file.name',
        'formula.priority_icon',
        'formula.status_badge',
        'due',
        'formula.modified_ago',
        'formula.word_estimate',
      ],
      groupBy: {
        property: 'status',
        direction: 'ASC',
      },
      summaries: {
        'formula.age_days': 'avgAge',
        'formula.word_estimate': 'totalWords',
      },
    },
    {
      type: 'table',
      name: 'Recent Only',
      limit: 20,
      filters: {
        and: ['formula.is_recent == true'],
      },
      order: [
        'file.mtime',
        'file.name',
        'formula.word_estimate',
      ],
    },
    {
      type: 'cards',
      name: 'Note Gallery',
      order: [
        'file.name',
        'formula.status_badge',
        'formula.tag_summary',
      ],
    },
    {
      type: 'list',
      name: 'Quick List',
      order: [
        'formula.priority_icon',
        'file.name',
      ],
      filters: {
        and: ['status != "done"'],
      },
    },
  ],
};

// =============================================================================
// EXAMPLE 13: Reactive Base Query Examples
// =============================================================================

// Define custom data type
interface Task {
  title: string;
  description?: string;
  assignee?: string;
}

// Create reactive source
const taskSource = ref<BaseSource<Task>[]>([
  {
    id: '1',
    name: 'Task 1.md',
    basename: 'Task 1',
    path: 'Tasks/Task 1.md',
    folder: 'Tasks',
    ext: 'md',
    tags: ['task', 'urgent'],
    properties: {
      status: 'todo',
      priority: 1,
      due: '2024-12-31',
    },
    data: {
      title: 'Complete documentation',
      description: 'Write the user guide',
      assignee: 'Alice',
    },
  },
  {
    id: '2',
    name: 'Task 2.md',
    basename: 'Task 2',
    path: 'Tasks/Task 2.md',
    folder: 'Tasks',
    ext: 'md',
    tags: ['task'],
    properties: {
      status: 'in-progress',
      priority: 2,
      due: '2024-12-25',
    },
    data: {
      title: 'Fix bugs',
      description: 'Address reported issues',
      assignee: 'Bob',
    },
  },
  {
    id: '3',
    name: 'Task 3.md',
    basename: 'Task 3',
    path: 'Archive/Task 3.md',
    folder: 'Archive',
    ext: 'md',
    tags: ['task', 'archived'],
    properties: {
      status: 'done',
      priority: 3,
    },
    data: {
      title: 'Initial setup',
      description: 'Project initialization',
      assignee: 'Charlie',
    },
  },
]);

// YAML base definition
const taskBaseYAML = `
filters:
  and:
    - file.hasTag("task")
    - '!file.hasTag("archived")'
formulas:
  days_until_due: 'if(due, ((date(due) - today()) / 86400000).round(0), "")'
  is_overdue: 'if(due, date(due) < today() && status != "done", false)'
  priority_label: 'if(priority == 1, "🔴 High", if(priority == 2, "🟡 Medium", "🟢 Low"))'
properties:
  status:
    displayName: Status
  formula.days_until_due:
    displayName: Days Left
  formula.priority_label:
    displayName: Priority
views:
  - type: table
    name: "Active Tasks"
    filters:
      and:
        - status != "done"
    order:
      - file.name
      - status
      - formula.priority_label
      - due
      - formula.days_until_due
    groupBy:
      property: status
      direction: ASC
    summaries:
      formula.days_until_due: Average
  - type: table
    name: "Completed"
    filters:
      and:
        - status == "done"
    order:
      - file.name
      - completed_date
`;

// Example 13a: Read base from YAML
const parsedBase = readBase(taskBaseYAML);
console.log('Parsed base:', parsedBase);

// Example 13b: Create reactive query
const query = new ReactiveBaseQuery(taskSource, parsedBase, { debug: true });

// Example 13c: Get reactive results for a view
const activeTasks = query.getViewResults('Active Tasks');
const completedTasks = query.getViewResults('Completed');

// Access reactive data
console.log('Active tasks:', activeTasks.value.items);
console.log('Total count:', activeTasks.value.totalCount);
console.log('Groups:', activeTasks.value.groups);
console.log('Summaries:', activeTasks.value.summaries);

// Example 13d: Using Vue composable (in a component)
function useTaskManager() {
  // Using the composable
  const { getViewResults, getAllResults, refresh, source, base } = useBaseQuery(
    taskSource,
    parsedBase,
    { debug: true }
  );

  // Get reactive results
  const activeTasks = getViewResults('Active Tasks');
  const allTasks = getAllResults();

  // Computed for template use
  const activeTaskCount = computed(() => activeTasks.value.totalCount);
  const hasOverdueTasks = computed(() =>
    activeTasks.value.items.some(item => item.properties?.is_overdue)
  );

  // Method to add a new task
  function addTask(task: BaseSource<Task>) {
    source.value.push(task);
    // Results automatically update due to reactivity
  }

  // Method to update a task
  function updateTask(id: string, updates: Partial<BaseSource<Task>>) {
    const index = source.value.findIndex(t => t.id === id);
    if (index !== -1) {
      source.value[index] = { ...source.value[index], ...updates };
      // Results automatically update due to reactivity
    }
  }

  // Method to refresh manually
  function forceRefresh() {
    refresh();
  }

  return {
    activeTasks,
    allTasks,
    activeTaskCount,
    hasOverdueTasks,
    addTask,
    updateTask,
    forceRefresh,
  };
}

// Example 13e: Using useBaseView composable for single view
function useActiveTasksOnly() {
  const { items, totalCount, groups, summaries, isProcessing, errors, refresh } =
    useBaseView(taskSource, parsedBase, 'Active Tasks');

  // items is a ComputedRef - automatically updates when source changes
  // Use in template: v-for="task in items" :key="task.id"

  return {
    tasks: items,
    count: totalCount,
    grouped: groups,
    summaryData: summaries,
    loading: isProcessing,
    errorMessages: errors,
    refresh,
  };
}

// Example 13f: Create query from YAML directly
const yamlQuery = createBaseQueryFromYAML(taskSource, taskBaseYAML, { debug: true });

// Example 13g: Create query from base object
const objectQuery = createBaseQuery(taskSource, taskTrackerBase);

// =============================================================================
// EXAMPLE 14: Advanced Reactive Patterns
// =============================================================================

// Pattern 1: Multiple views with shared source
function useMultiViewDashboard() {
  const source = ref<BaseSource[]>([/* ... */]);
  const base = readBase(`
    views:
      - type: table
        name: "All Items"
        order: [file.name]
      - type: cards
        name: "Gallery"
        order: [file.name, cover]
      - type: list
        name: "Quick List"
        limit: 10
  `);

  const query = new ReactiveBaseQuery(source, base);

  return {
    tableView: query.getViewResults('All Items'),
    cardsView: query.getViewResults('Gallery'),
    listView: query.getViewResults('Quick List'),
    source,
  };
}

// Pattern 2: Dynamic base switching
function useDynamicBase() {
  const source = ref<BaseSource[]>([/* ... */]);
  const currentBaseName = ref('tasks');

  const bases: Record<string, ObsidianBase> = {
    tasks: readBase(`
      filters:
        and:
          - file.hasTag("task")
      views:
        - type: table
          name: "Tasks"
          order: [file.name, status]
    `),
    notes: readBase(`
      filters:
        and:
          - file.hasTag("note")
      views:
        - type: cards
          name: "Notes"
          order: [file.name, content]
    `),
  };

  const currentBase = computed(() => bases[currentBaseName.value]);
  const query = new ReactiveBaseQuery(source, currentBase);

  function switchBase(name: string) {
    currentBaseName.value = name;
    // Query automatically updates due to reactive base
  }

  return {
    results: query.getAllResults(),
    switchBase,
    currentBaseName,
  };
}

// Pattern 3: Custom formula functions
function useCustomFunctions() {
  const source = ref<BaseSource[]>([/* ... */]);

  const base = readBase(`
    formulas:
      custom_score: 'calculateScore(priority, complexity)'
    views:
      - type: table
        name: "Scored Items"
        order: [formula.custom_score]
  `);

  const query = new ReactiveBaseQuery(source, base, {
    customFunctions: {
      calculateScore: (priority: number, complexity: number) => {
        return priority * complexity * 10;
      },
    },
  });

  return query.getViewResults('Scored Items');
}

// Pattern 4: Reactive filtering with user input
function useSearchableList() {
  const source = ref<BaseSource[]>([/* ... */]);
  const searchQuery = ref('');

  const base = computed(() => readBase(`
    filters:
      ${searchQuery.value ? `and:
        - 'file.name.contains("${searchQuery.value}")'` : ''}
    views:
      - type: list
        name: "Search Results"
        order: [file.name]
  `));

  const query = new ReactiveBaseQuery(source, base);

  return {
    results: query.getViewResults('Search Results'),
    searchQuery,
  };
}

// =============================================================================
// EXAMPLE 15: Export all examples
// =============================================================================

export const examples = {
  taskTrackerBase,
  readingListBase,
  projectNotesBase,
  dailyNotesBase,
  complexFilter,
  builtFilter,
  advancedFormulas,
  completeBase,
  // Reactive examples
  taskSource,
  taskBaseYAML,
  parsedBase,
  query,
  useTaskManager,
  useActiveTasksOnly,
  useMultiViewDashboard,
  useDynamicBase,
  useCustomFunctions,
  useSearchableList,
};

export default examples;
