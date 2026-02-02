/**
 * Simple Reactive Base Demo
 * 
 * This demonstrates the key features of ReactiveBase in a concise example.
 */

import { ref } from 'vue';
import { createReactiveBase, ReactiveBaseQuery, BaseSource } from '../src/index';

// Sample task interface
interface Task {
  title: string;
  assignee: string;
}

// Create sample data
const tasks = ref<BaseSource<Task>[]>([
  {
    id: '1',
    name: 'Fix bug.md',
    tags: ['task', 'urgent'],
    properties: { status: 'todo', priority: 1 },
    data: { title: 'Fix critical bug', assignee: 'Alice' },
  },
  {
    id: '2',
    name: 'Write docs.md',
    tags: ['task'],
    properties: { status: 'in-progress', priority: 2 },
    data: { title: 'Write documentation', assignee: 'Bob' },
  },
  {
    id: '3',
    name: 'Deploy.md',
    tags: ['task'],
    properties: { status: 'done', priority: 1 },
    data: { title: 'Deploy to production', assignee: 'Charlie' },
  },
]);

// Create a reactive base
const base = createReactiveBase();

// Initial setup
console.log('=== Initial Setup ===');
base
  .addFilter('file.hasTag("task")')
  .addFormula('priority_label', 'if(priority == 1, "🔴 High", "🟡 Medium")')
  .addTableView('All Tasks', {
    order: ['formula.priority_label', 'file.name'],
  });

// Create query
const query = new ReactiveBaseQuery(tasks, base.ref, { debug: true });
const results = query.getViewResults('All Tasks');

console.log(`Total tasks: ${results.value.items.length}`);
console.log('Tasks:', results.value.items.map(t => t.name));

// Add another view dynamically
console.log('\n=== Adding Active Tasks View ===');
base.addTableView('Active Tasks', {
  filters: 'status != "done"',
  order: ['formula.priority_label', 'file.name'],
});

const activeResults = query.getViewResults('Active Tasks');
console.log(`Active tasks: ${activeResults.value.items.length}`);
console.log('Active tasks:', activeResults.value.items.map(t => t.name));

// Modify the filter
console.log('\n=== Changing Filter to Urgent Only ===');
base.clearFilters();
base.addFilter('file.hasTag("urgent")');

console.log(`Urgent tasks: ${results.value.items.length}`);
console.log('Urgent tasks:', results.value.items.map(t => t.name));

// Add a new formula
console.log('\n=== Adding Status Icon Formula ===');
base.addFormula(
  'status_icon',
  'if(status == "done", "✅", if(status == "in-progress", "⏳", "⏸️"))'
);

// Update view to use new formula
base.setViewOrder('All Tasks', ['formula.status_icon', 'file.name']);

console.log('Tasks with icons:', results.value.items);

// Update source data
console.log('\n=== Adding New Urgent Task ===');
tasks.value.push({
  id: '4',
  name: 'Emergency fix.md',
  tags: ['task', 'urgent'],
  properties: { status: 'todo', priority: 1 },
  data: { title: 'Emergency hotfix', assignee: 'Dana' },
});

console.log(`Urgent tasks after addition: ${results.value.items.length}`);
console.log('Current urgent tasks:', results.value.items.map(t => t.name));

// Convert to YAML
console.log('\n=== Generated YAML Configuration ===');
console.log(base.toYAML());

// Clone and modify
console.log('\n=== Cloning Base ===');
const clonedBase = base.clone();
clonedBase.addTableView('Test View', { order: ['file.name'] });

console.log('Original views:', base.value.views.map(v => v.name));
console.log('Cloned views:', clonedBase.value.views.map(v => v.name));

console.log('\n=== Demo Complete ===');
