/**
 * Reactive Base Example
 *
 * This example demonstrates how to use the ReactiveBase class to create
 * and modify base configurations dynamically with real-time reactivity.
 */

import { ref } from 'vue';
import {
  createReactiveBase,
  createReactiveBaseFromYAML,
  ReactiveBaseQuery,
  BaseSource,
  PresetFilters,
  PresetFormulas,
} from '../src/index';

// =============================================================================
// Example 1: Creating and modifying a reactive base
// =============================================================================

// Create an empty reactive base
const base = createReactiveBase();

// Add global filters dynamically
base.addFilter('file.hasTag("project")');
base.addFilter('file.ext == "md"');

// Add formulas
base.addFormula('days_old', PresetFormulas.daysOld());
base.addFormula('priority_label', PresetFormulas.priorityLabel());
base.addFormula('status_icon', PresetFormulas.statusIcon());

// Configure property display names
base.configureProperty('formula.days_old', { displayName: 'Days Old' });
base.configureProperty('formula.priority_label', { displayName: 'Priority' });

// Add views
base.addTableView('All Projects', {
  order: ['file.name', 'formula.priority_label', 'formula.days_old'],
});

base.addTableView('Active Projects', {
  order: ['file.name', 'status', 'formula.status_icon'],
  filters: 'status != "done"',
  limit: 50,
});

base.addCardsView('Project Cards', {
  order: ['formula.priority_label', 'file.name'],
  groupBy: { property: 'status', direction: 'ASC' },
});

// Convert to YAML to save
const yaml = base.toYAML();
console.log('Generated YAML:\n', yaml);

// =============================================================================
// Example 2: Loading from YAML and modifying
// =============================================================================

const yamlConfig = `
filters:
  and:
    - file.hasTag("task")
formulas:
  is_overdue: 'if(due, date(due) < today() && status != "done", false)'
views:
  - type: table
    name: "Tasks"
    order:
      - file.name
      - due
`;

// Load from YAML
const taskBase = createReactiveBaseFromYAML(yamlConfig);

// Modify the loaded base
taskBase.addFormula('days_until_due', PresetFormulas.daysUntilDue());
taskBase.addTableView('Overdue Tasks', {
  filters: 'formula.is_overdue == true',
  order: ['due', 'file.name'],
});

// =============================================================================
// Example 3: Real-time reactive updates with query
// =============================================================================

interface Task {
  title: string;
  description: string;
  assignee: string;
}

// Create reactive source data
const source = ref<BaseSource<Task>[]>([
  {
    id: '1',
    name: 'Task 1.md',
    basename: 'Task 1',
    tags: ['task', 'urgent'],
    properties: {
      status: 'todo',
      priority: 1,
      due: '2024-12-31',
    },
    data: {
      title: 'Complete documentation',
      description: 'Write comprehensive docs',
      assignee: 'Alice',
    },
  },
  {
    id: '2',
    name: 'Task 2.md',
    basename: 'Task 2',
    tags: ['task'],
    properties: {
      status: 'done',
      priority: 2,
      due: '2024-11-15',
    },
    data: {
      title: 'Fix critical bug',
      description: 'Resolve memory leak',
      assignee: 'Bob',
    },
  },
  {
    id: '3',
    name: 'Task 3.md',
    basename: 'Task 3',
    tags: ['task', 'feature'],
    properties: {
      status: 'in-progress',
      priority: 1,
      due: '2024-12-20',
    },
    data: {
      title: 'Implement new feature',
      description: 'Add user authentication',
      assignee: 'Charlie',
    },
  },
]);

// Create a reactive base
const dynamicBase = createReactiveBase();
dynamicBase
  .addFilter('file.hasTag("task")')
  .addFormula('priority_label', PresetFormulas.priorityLabel())
  .addTableView('All Tasks', {
    order: ['formula.priority_label', 'file.name'],
  });

// Create a reactive query using the reactive base
const query = new ReactiveBaseQuery(source, dynamicBase.ref, { debug: true });

// Get reactive results
const allTasks = query.getViewResults('All Tasks');

console.log('Initial tasks:', allTasks.value.items.length);

// =============================================================================
// Example 4: Dynamic view modifications
// =============================================================================

// Add a new view dynamically
dynamicBase.addTableView('High Priority Tasks', {
  filters: 'priority == 1',
  order: ['due', 'file.name'],
});

// Get results for the new view (automatically reactive)
const highPriorityTasks = query.getViewResults('High Priority Tasks');
console.log('High priority tasks:', highPriorityTasks.value.items.length);

// Update an existing view's filters
dynamicBase.setViewFilters('All Tasks', {
  and: ['file.hasTag("task")', 'status != "done"'],
});

// The results automatically update!
console.log('Active tasks only:', allTasks.value.items.length);

// =============================================================================
// Example 5: Real-time formula updates
// =============================================================================

// Add a new formula dynamically
dynamicBase.addFormula('urgency_score', 'priority * 10 + if(status == "urgent", 50, 0)');

// Update a view to use the new formula
dynamicBase.setViewOrder('All Tasks', ['formula.urgency_score', 'file.name']);

// Results automatically recalculate with the new formula
console.log('Sorted by urgency:', allTasks.value.items);

// =============================================================================
// Example 6: Filter adjustments
// =============================================================================

// Clear existing filters
dynamicBase.clearFilters();

// Add new filters
dynamicBase.addFilter('file.hasTag("project")');
dynamicBase.addFilter('status == "active"');

// Update source data dynamically
source.value.push({
  id: '4',
  name: 'Project Alpha.md',
  basename: 'Project Alpha',
  tags: ['project'],
  properties: {
    status: 'active',
    priority: 1,
  },
  data: {
    title: 'Project Alpha',
    description: 'New project',
    assignee: 'Dana',
  },
});

// Both the base changes and source changes trigger updates!
console.log('Updated results:', allTasks.value.items.length);

// =============================================================================
// Example 7: View management
// =============================================================================

// List all views
console.log('Available views:', query.getViewNames().value);

// Get a specific view configuration
const taskView = dynamicBase.getView('All Tasks');
console.log('Task view config:', taskView);

// Update view limit
dynamicBase.setViewLimit('All Tasks', 10);

// Update groupBy
dynamicBase.setViewGroupBy('All Tasks', {
  property: 'status',
  direction: 'ASC',
});

// Remove a view
dynamicBase.removeView('High Priority Tasks');

console.log('Views after removal:', query.getViewNames().value);

// =============================================================================
// Example 8: Cloning and resetting
// =============================================================================

// Clone the base for experimentation
const clonedBase = dynamicBase.clone();

// Modify the clone without affecting the original
clonedBase.addFormula('test_formula', '1 + 1');
clonedBase.addTableView('Test View', { order: ['file.name'] });

// Original remains unchanged
console.log('Original formulas:', Object.keys(dynamicBase.value.formulas || {}));
console.log('Cloned formulas:', Object.keys(clonedBase.value.formulas || {}));

// Reset to empty state
clonedBase.reset();
console.log('After reset:', clonedBase.value);

// =============================================================================
// Example 9: Complete workflow
// =============================================================================

function createTaskManagementSystem() {
  // 1. Create reactive base with initial configuration
  const base = createReactiveBase();
  
  base
    .setFilters({ and: ['file.hasTag("task")', 'file.ext == "md"'] })
    .addFormula('days_until_due', PresetFormulas.daysUntilDue())
    .addFormula('is_overdue', PresetFormulas.isOverdue())
    .addFormula('priority_label', PresetFormulas.priorityLabel())
    .configureProperty('formula.days_until_due', { displayName: 'Days Left' })
    .configureProperty('formula.is_overdue', { displayName: 'Overdue?' })
    .addTableView('Active Tasks', {
      filters: 'status != "done"',
      order: ['formula.priority_label', 'due', 'file.name'],
      groupBy: { property: 'status', direction: 'ASC' },
    })
    .addTableView('Overdue Tasks', {
      filters: 'formula.is_overdue == true',
      order: ['due', 'formula.priority_label'],
    })
    .addTableView('Completed Tasks', {
      filters: 'status == "done"',
      order: ['completed_date', 'file.name'],
    });

  // 2. Save configuration to file
  const config = base.toYAML();
  console.log('Configuration saved:\n', config);

  return base;
}

// Create the system
const taskSystem = createTaskManagementSystem();

// Use it with reactive queries
const taskQuery = new ReactiveBaseQuery(source, taskSystem.ref);
const activeTasks = taskQuery.getViewResults('Active Tasks');

// Later, update the system dynamically
taskSystem.addFormula('assignee_initial', 'assignee.substring(0, 1)');
taskSystem.setViewOrder('Active Tasks', [
  'formula.priority_label',
  'formula.assignee_initial',
  'due',
]);

// All queries automatically update with the new configuration!
console.log('System updated, tasks:', activeTasks.value.items);

// =============================================================================
// Example 10: Integration with Vue components
// =============================================================================

/*
// In a Vue component:
<script setup lang="ts">
import { ref, computed } from 'vue';
import { createReactiveBase, ReactiveBaseQuery, BaseSource } from './index';

// Create reactive source
const tasks = ref<BaseSource<Task>[]>([...]);

// Create reactive base
const base = createReactiveBase();
base.addFilter('file.hasTag("task")')
    .addFormula('priority_label', PresetFormulas.priorityLabel())
    .addTableView('Tasks', { order: ['file.name'] });

// Create query
const query = new ReactiveBaseQuery(tasks, base.ref);
const taskResults = query.getViewResults('Tasks');

// Use in template
const displayTasks = computed(() => taskResults.value.items);

// Dynamically add a filter based on user input
function filterByStatus(status: string) {
  base.setViewFilters('Tasks', `status == "${status}"`);
  // Results automatically update!
}

// Add a new view on the fly
function createUrgentView() {
  base.addTableView('Urgent', {
    filters: 'priority == 1',
    order: ['due']
  });
  
  // Now you can access results for this new view
  const urgentResults = query.getViewResults('Urgent');
  console.log('Urgent tasks:', urgentResults.value.items);
}
</script>

<template>
  <div>
    <h1>Tasks ({{ displayTasks.length }})</h1>
    <ul>
      <li v-for="task in displayTasks" :key="task.id">
        {{ task.name }} - {{ task.properties?.status }}
      </li>
    </ul>
    
    <button @click="filterByStatus('done')">Show Completed</button>
    <button @click="filterByStatus('todo')">Show Todo</button>
    <button @click="createUrgentView()">Create Urgent View</button>
  </div>
</template>
*/

export {
  base,
  taskBase,
  dynamicBase,
  taskSystem,
  source,
  query,
  allTasks,
};
