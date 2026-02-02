<template>
  <div class="base-manager">
    <header>
      <h1>Base Manager</h1>
      <div class="status">
        <span :class="{ active: isLoaded }">
          {{ isLoaded ? '✓ Loaded' : '○ Not Loaded' }}
        </span>
        <span v-if="hasChanges" class="changes">● Unsaved Changes</span>
      </div>
    </header>

    <!-- Load/Save Controls -->
    <section class="controls">
      <button @click="loadFromFile">Load from File</button>
      <button @click="saveToFile" :disabled="!hasChanges">Save</button>
      <button @click="resetBase">Reset</button>
    </section>

    <!-- Statistics -->
    <section class="stats">
      <div class="stat">
        <label>Items:</label>
        <span>{{ state.itemCount }}</span>
      </div>
      <div class="stat">
        <label>Views:</label>
        <span>{{ state.viewCount }}</span>
      </div>
      <div class="stat">
        <label>Formulas:</label>
        <span>{{ state.formulaCount }}</span>
      </div>
      <div class="stat">
        <label>Filters:</label>
        <span>{{ state.hasFilters ? 'Yes' : 'No' }}</span>
      </div>
    </section>

    <!-- View Tabs -->
    <section class="views">
      <div class="tabs">
        <button
          v-for="viewName in viewNames"
          :key="viewName"
          :class="{ active: currentView === viewName }"
          @click="currentView = viewName"
        >
          {{ viewName }}
        </button>
        <button @click="showAddViewDialog" class="add-btn">+ Add View</button>
      </div>

      <!-- View Results -->
      <div v-if="currentView" class="results">
        <div class="result-header">
          <h3>{{ currentView }}</h3>
          <span class="count">{{ currentResults?.totalCount || 0 }} items</span>
        </div>

        <table v-if="currentResults">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in currentResults.items" :key="item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.properties?.status }}</td>
              <td>{{ item.properties?.priority_label || item.properties?.priority }}</td>
              <td>
                <button @click="editItem(item)" size="small">Edit</button>
                <button @click="deleteItem(item.id)" size="small" type="danger">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Add Item Form -->
    <section class="add-item">
      <h3>Add New Item</h3>
      <form @submit.prevent="addNewItem">
        <input v-model="newItem.name" placeholder="Name" required />
        <input v-model="newItem.status" placeholder="Status" />
        <input v-model.number="newItem.priority" type="number" placeholder="Priority" />
        <button type="submit">Add Item</button>
      </form>
    </section>

    <!-- Formula Manager -->
    <section class="formulas">
      <h3>Formulas</h3>
      <div v-for="(expr, name) in formulas" :key="name" class="formula-item">
        <code>{{ name }}</code>: <code>{{ expr }}</code>
        <button @click="removeFormula(name)" size="small">Remove</button>
      </div>
      <div class="add-formula">
        <input v-model="newFormula.name" placeholder="Formula name" />
        <input v-model="newFormula.expression" placeholder="Expression" />
        <button @click="addNewFormula">Add Formula</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useBase, BaseSource } from '../src/index';

interface Task {
  title: string;
  description: string;
}

// Initialize useBase
const {
  base,
  source,
  load,
  save,
  reset,
  isLoaded,
  hasChanges,
  state,
  viewNames,
  getViewResults,
  addItem,
  updateItem,
  removeItem,
  addFormula,
  removeFormula: removeFormulaFn,
  formulas,
} = useBase<Task>({
  source: ref<BaseSource<Task>[]>([]),
  trackChanges: true,
  debug: true,
});

// Current view state
const currentView = ref<string>('');

// Watch viewNames and set first view as current
watch(viewNames, (names) => {
  if (names.length > 0 && !currentView.value) {
    currentView.value = names[0];
  }
}, { immediate: true });

// Current view results
const currentResults = computed(() => {
  if (!currentView.value) return null;
  return getViewResults(currentView.value).value;
});

// New item form
const newItem = ref({
  name: '',
  status: 'todo',
  priority: 1,
});

const addNewItem = () => {
  if (!newItem.value.name) return;
  
  addItem({
    id: `item-${Date.now()}`,
    name: newItem.value.name,
    tags: ['task'],
    properties: {
      status: newItem.value.status,
      priority: newItem.value.priority,
    },
    data: {
      title: newItem.value.name,
      description: '',
    },
  });
  
  // Reset form
  newItem.value = {
    name: '',
    status: 'todo',
    priority: 1,
  };
};

// Edit item
const editItem = (item: BaseSource<Task>) => {
  const newStatus = prompt('Enter new status:', item.properties?.status as string);
  if (newStatus && item.id) {
    updateItem(item.id, {
      properties: {
        ...item.properties,
        status: newStatus,
      },
    });
  }
};

// Delete item
const deleteItem = (id: string | undefined) => {
  if (id && confirm('Are you sure you want to delete this item?')) {
    removeItem(id);
  }
};

// Load from file
const loadFromFile = () => {
  const yaml = prompt('Paste YAML configuration:');
  if (yaml) {
    try {
      load(yaml);
      alert('Configuration loaded successfully!');
    } catch (error) {
      alert(`Error loading configuration: ${error}`);
    }
  }
};

// Save to file
const saveToFile = () => {
  const yaml = save();
  
  // In a real app, you'd save to file system
  // For demo, we'll copy to clipboard
  navigator.clipboard.writeText(yaml).then(() => {
    alert('Configuration copied to clipboard!');
  });
};

// Reset base
const resetBase = () => {
  if (confirm('Are you sure you want to reset? All unsaved changes will be lost.')) {
    reset();
  }
};

// Add view dialog
const showAddViewDialog = () => {
  const name = prompt('View name:');
  if (name) {
    base.addTableView(name, {
      order: ['file.name'],
    });
  }
};

// Formula management
const newFormula = ref({
  name: '',
  expression: '',
});

const addNewFormula = () => {
  if (newFormula.value.name && newFormula.value.expression) {
    addFormula(newFormula.value.name, newFormula.value.expression);
    newFormula.value = { name: '', expression: '' };
  }
};

// Auto-save (optional)
let saveTimeout: NodeJS.Timeout | null = null;

watch(hasChanges, (changed) => {
  if (changed) {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    // Auto-save after 2 seconds of no changes
    saveTimeout = setTimeout(() => {
      const yaml = save();
      console.log('Auto-saved:', yaml.substring(0, 100) + '...');
      // In production: await saveToFileSystem(yaml);
    }, 2000);
  }
});
</script>

<style scoped>
.base-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
}

.status {
  display: flex;
  gap: 10px;
  font-size: 14px;
}

.status .active {
  color: #4caf50;
}

.status .changes {
  color: #ff9800;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #f5f5f5;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.stat {
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
  text-align: center;
}

.stat label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.stat span {
  font-size: 24px;
  font-weight: bold;
}

.tabs {
  display: flex;
  gap: 5px;
  margin-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
}

.tabs button {
  padding: 10px 20px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  cursor: pointer;
}

.tabs button.active {
  border-bottom-color: #2196f3;
  color: #2196f3;
}

.tabs .add-btn {
  margin-left: auto;
  color: #4caf50;
}

.results {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 15px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.result-header .count {
  color: #666;
  font-size: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

th {
  background: #f5f5f5;
  font-weight: 600;
}

.add-item, .formulas {
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

form, .add-formula {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.formula-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  margin-bottom: 5px;
}

code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}
</style>
