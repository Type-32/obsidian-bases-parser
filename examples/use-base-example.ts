/**
 * useBase() Composable Example
 * 
 * Demonstrates the unified base management composable that provides
 * a complete interface for loading, modifying, saving, and querying
 * base configurations with reactive data.
 */

import { ref } from 'vue';
import { useBase, BaseSource } from '../src/index';

// =============================================================================
// Example 1: Basic Usage - Create, Load, and Query
// =============================================================================

console.log('=== Example 1: Basic Usage ===\n');

interface Task {
  title: string;
  description: string;
}

// Create initial data
const initialTasks = ref<BaseSource<Task>[]>([
  {
    id: '1',
    name: 'Task 1.md',
    tags: ['task', 'urgent'],
    properties: { status: 'todo', priority: 1 },
    data: { title: 'Fix critical bug', description: 'Memory leak in parser' },
  },
  {
    id: '2',
    name: 'Task 2.md',
    tags: ['task'],
    properties: { status: 'in-progress', priority: 2 },
    data: { title: 'Write documentation', description: 'API reference' },
  },
]);

// Initialize with useBase
const {
  base,
  source,
  load,
  save,
  addView,
  getViewResults,
  state,
  isLoaded,
} = useBase<Task>({
  source: initialTasks,
  debug: true,
  trackChanges: true,
});

console.log('Initial state:', {
  isLoaded: isLoaded.value,
  itemCount: state.value.itemCount,
  viewCount: state.value.viewCount,
});

// =============================================================================
// Example 2: Load from YAML
// =============================================================================

console.log('\n=== Example 2: Load from YAML ===\n');

const yamlConfig = `
filters:
  and:
    - file.hasTag("task")
formulas:
  priority_label: 'if(priority == 1, "🔴 High", "🟡 Medium")'
  status_icon: 'if(status == "done", "✅", if(status == "in-progress", "⏳", "⏸️"))'
views:
  - type: table
    name: All Tasks
    order:
      - formula.status_icon
      - file.name
      - formula.priority_label
  - type: table
    name: Active Tasks
    filters:
      and:
        - status != "done"
    order:
      - formula.priority_label
      - file.name
`;

load(yamlConfig);

console.log('After loading YAML:', {
  isLoaded: isLoaded.value,
  viewCount: state.value.viewCount,
  formulaCount: state.value.formulaCount,
  hasFilters: state.value.hasFilters,
});

// =============================================================================
// Example 3: Query Data
// =============================================================================

console.log('\n=== Example 3: Query Data ===\n');

const allTasks = getViewResults('All Tasks');
const activeTasks = getViewResults('Active Tasks');

console.log('All tasks:', allTasks.value.items.length);
console.log('Active tasks:', activeTasks.value.items.length);

console.log('\nAll tasks with formulas:');
allTasks.value.items.forEach(task => {
  console.log(`  - ${task.name}: ${task.properties?.status_icon} ${task.properties?.priority_label}`);
});

// =============================================================================
// Example 4: Modify Base Dynamically
// =============================================================================

console.log('\n=== Example 4: Modify Base Dynamically ===\n');

const {
  base: dynamicBase,
  source: dynamicSource,
  addFormula,
  addView: addViewDynamic,
  removeView,
  getViewResults: getResults,
  state: dynamicState,
  hasChanges,
} = useBase<Task>({
  source: ref([]),
  trackChanges: true,
});

console.log('Has changes (initial):', hasChanges.value);

// Add filters
dynamicBase.addFilter('file.hasTag("project")');
console.log('Added filter, has changes:', hasChanges.value);

// Add formulas
addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)');
addFormula('urgency', 'priority * 10 + if(status == "urgent", 50, 0)');

// Add views
addViewDynamic({
  type: 'table',
  name: 'Projects',
  order: ['file.name', 'formula.days_old'],
});

addViewDynamic({
  type: 'cards',
  name: 'Project Cards',
  order: ['formula.urgency'],
  cardSize: 250,
  image: 'cover',
});

console.log('After modifications:', {
  viewCount: dynamicState.value.viewCount,
  formulaCount: dynamicState.value.formulaCount,
  hasChanges: hasChanges.value,
});

// =============================================================================
// Example 5: Source Data Management
// =============================================================================

console.log('\n=== Example 5: Source Data Management ===\n');

const {
  source: managedSource,
  addItem,
  updateItem,
  removeItem,
  clearSource,
  state: managedState,
} = useBase<Task>({
  source: ref([
    {
      id: '1',
      name: 'Item 1.md',
      properties: { status: 'todo' },
      data: { title: 'Initial item', description: 'Test' },
    },
  ]),
});

console.log('Initial item count:', managedState.value.itemCount);

// Add item
addItem({
  id: '2',
  name: 'Item 2.md',
  properties: { status: 'in-progress' },
  data: { title: 'New item', description: 'Added dynamically' },
});

console.log('After adding:', managedState.value.itemCount);

// Update item
updateItem('2', {
  properties: { status: 'done' },
});

console.log('Updated item 2:', managedSource.value.find(i => i.id === '2')?.properties?.status);

// Remove item
removeItem('1');
console.log('After removing:', managedState.value.itemCount);

// =============================================================================
// Example 6: Save and Export
// =============================================================================

console.log('\n=== Example 6: Save and Export ===\n');

const {
  base: saveBase,
  save: saveToYaml,
  load: loadYaml,
  clone,
  hasChanges: saveHasChanges,
} = useBase({
  trackChanges: true,
});

// Create a base
saveBase
  .addFilter('file.hasTag("note")')
  .addFormula('word_count', '(file.size / 5).round(0)')
  .addTableView('Notes', { order: ['file.name', 'formula.word_count'] });

// Save to YAML
const yaml = saveToYaml();

console.log('Saved YAML:');
console.log('─'.repeat(60));
console.log(yaml);
console.log('─'.repeat(60));

console.log('Has changes after save:', saveHasChanges.value);

// Clone for experimentation
const clonedBase = clone();
clonedBase.addFormula('test', '1 + 1');

console.log('Original formulas:', Object.keys(saveBase.value.formulas || {}).length);
console.log('Cloned formulas:', Object.keys(clonedBase.value.formulas || {}).length);

// =============================================================================
// Example 7: Complete Workflow - Task Management
// =============================================================================

console.log('\n=== Example 7: Complete Workflow ===\n');

interface TaskData {
  title: string;
  assignee: string;
  notes: string;
}

const {
  base: taskBase,
  source: taskSource,
  load: loadTaskBase,
  save: saveTaskBase,
  addItem: addTask,
  updateItem: updateTask,
  getViewResults: getTaskResults,
  addFormula: addTaskFormula,
  state: taskState,
  viewNames,
  hasChanges: taskHasChanges,
} = useBase<TaskData>({
  source: ref<BaseSource<TaskData>[]>([]),
  trackChanges: true,
  debug: false,
});

// Load configuration
const taskYaml = `
filters:
  and:
    - file.hasTag("task")
    - file.ext == "md"
formulas:
  priority_label: 'if(priority == 1, "🔴 High", if(priority == 2, "🟡 Medium", "🟢 Low"))'
  is_overdue: 'if(due, date(due) < today() && status != "done", false)'
views:
  - type: table
    name: All Tasks
    order:
      - formula.priority_label
      - file.name
      - due
  - type: table
    name: Overdue
    filters:
      and:
        - formula.is_overdue == true
    order:
      - due
      - file.name
`;

loadTaskBase(taskYaml);

console.log('Loaded task base:');
console.log('  - Views:', viewNames.value.join(', '));
console.log('  - Formulas:', taskState.value.formulaCount);
console.log('  - Has filters:', taskState.value.hasFilters);

// Add tasks
addTask({
  id: 't1',
  name: 'Urgent Bug Fix.md',
  tags: ['task', 'urgent'],
  properties: {
    status: 'todo',
    priority: 1,
    due: '2024-01-15',
  },
  data: {
    title: 'Fix production bug',
    assignee: 'Alice',
    notes: 'Critical memory leak',
  },
});

addTask({
  id: 't2',
  name: 'Documentation.md',
  tags: ['task'],
  properties: {
    status: 'in-progress',
    priority: 2,
    due: '2024-01-20',
  },
  data: {
    title: 'Write API docs',
    assignee: 'Bob',
    notes: 'Include examples',
  },
});

addTask({
  id: 't3',
  name: 'Code Review.md',
  tags: ['task'],
  properties: {
    status: 'done',
    priority: 2,
    due: '2024-01-10',
  },
  data: {
    title: 'Review PR #123',
    assignee: 'Charlie',
    notes: 'Already completed',
  },
});

// Query tasks
const allTasksResult = getTaskResults('All Tasks');
const overdueResult = getTaskResults('Overdue');

console.log('\nTask Statistics:');
console.log('  - Total tasks:', taskState.value.itemCount);
console.log('  - All tasks view:', allTasksResult.value.items.length);
console.log('  - Overdue tasks:', overdueResult.value.items.length);

// Update task
updateTask('t1', {
  properties: { status: 'in-progress' },
});

console.log('\nUpdated task t1 status to in-progress');

// Add dynamic formula
addTaskFormula('assignee_initial', 'assignee.substring(0, 1)');

// Save updated configuration
const updatedYaml = saveTaskBase();

console.log('\nConfiguration saved. Has changes:', taskHasChanges.value);

// =============================================================================
// Example 8: Auto-save Implementation Pattern
// =============================================================================

console.log('\n=== Example 8: Auto-save Pattern ===\n');

const {
  save: autoSave,
  hasChanges: autoHasChanges,
} = useBase({
  base: yamlConfig,
  trackChanges: true,
});

// Watch for changes and save (developer implements this)
let saveTimeout: NodeJS.Timeout | null = null;

watch(autoHasChanges, (changed) => {
  if (changed) {
    console.log('Changes detected, scheduling save...');
    
    // Debounce saves
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(() => {
      const yaml = autoSave();
      console.log('Auto-saved configuration');
      // Here you would: await writeFile('config.base', yaml);
    }, 1000); // Save after 1 second of no changes
  }
});

// Simulate changes
autoSave.base.addFormula('test1', '1 + 1');
setTimeout(() => {
  autoSave.base.addFormula('test2', '2 + 2');
}, 500);

// =============================================================================
// Example 9: View Management
// =============================================================================

console.log('\n=== Example 9: View Management ===\n');

const {
  views,
  addView: addViewManaged,
  removeView: removeViewManaged,
  updateView,
  getView,
} = useBase();

// Add views
addViewManaged({
  type: 'table',
  name: 'View 1',
  order: ['file.name'],
});

addViewManaged({
  type: 'cards',
  name: 'View 2',
  order: ['file.name'],
  cardSize: 200,
});

console.log('Views:', views.value.map(v => v.name).join(', '));

// Update view
updateView('View 1', (view) => ({
  ...view,
  order: ['file.name', 'file.mtime'],
}));

console.log('Updated View 1 order:', getView('View 1')?.order);

// Remove view
removeViewManaged('View 2');
console.log('Views after removal:', views.value.map(v => v.name).join(', '));

// =============================================================================
// Summary
// =============================================================================

console.log('\n=== Summary ===\n');
console.log('useBase() provides:');
console.log('✓ Unified base management');
console.log('✓ Reactive queries');
console.log('✓ Load/save from YAML or objects');
console.log('✓ Source data management (add/update/remove)');
console.log('✓ Change tracking');
console.log('✓ View/formula/filter management');
console.log('✓ State and statistics');
console.log('✓ Foundation for auto-save patterns');
console.log('✓ Perfect for building base editors/viewers');
