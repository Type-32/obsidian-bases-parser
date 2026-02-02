/**
 * Obsidian Bases Reactive Query System
 *
 * Provides reactive querying capabilities for Obsidian Bases with Vue integration.
 * Supports reactive source arrays, computed results, and automatic re-evaluation.
 */

import {
  ref,
  computed,
  watch,
  type Ref,
  type ComputedRef,
  type UnwrapRef,
} from 'vue';

import {
  ObsidianBase,
  View,
  Filter,
  FilterExpObject,
  FilterObject,
  BaseSource,
  ReactiveBaseQueryOptions,
  ReactiveBaseQueryResult,
  QueryState,
  ExecutionContext,
  RuntimeValue,
  RuntimeValueType,
  SortDirection,
  SortConfig,
  DefaultSummaryFormula,
  ImageFit,
  ImageSource,
  Formulas,
  Properties,
  Summaries,
  PropertyConfig,
} from './obsidian-bases-schema';

import {
  Lexer,
  Parser,
  Evaluator,
  FilterExpressionParser,
  parseFilterExpression,
  BUILTIN_FUNCTIONS,
} from './obsidian-bases-parser';

// =============================================================================
// YAML PARSER - Read base from YAML
// =============================================================================

import * as yaml from 'js-yaml';

/**
 * Parse a YAML string into an ObsidianBase object.
 * Uses js-yaml for robust YAML parsing.
 */
export function readBase(yamlString: string): ObsidianBase {
  try {
    const parsed = yaml.load(yamlString) as Partial<ObsidianBase>;
    
    // Ensure views array exists
    if (!parsed.views) {
      parsed.views = [];
    }
    
    // Validate and normalize the parsed structure
    return normalizeBase(parsed);
  } catch (error) {
    throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Normalize and validate a parsed base object
 */
function normalizeBase(parsed: Partial<ObsidianBase>): ObsidianBase {
  // Ensure views is an array
  const views = Array.isArray(parsed.views) ? parsed.views : [];
  
  return {
    filters: parsed.filters,
    formulas: parsed.formulas,
    properties: parsed.properties,
    summaries: parsed.summaries,
    views,
  };
}

// =============================================================================
// REACTIVE BASE QUERY
// =============================================================================

/**
 * Reactive base query class that provides reactive filtering, sorting,
 * grouping, and formula evaluation for a source array.
 *
 * This class is designed to work seamlessly with Vue's reactivity system.
 *
 * @example
 * ```typescript
 * // Create reactive source
 * const source = ref<BaseSource<Task>[]>([
 *   { id: '1', name: 'Task 1.md', properties: { status: 'todo', priority: 1 } },
 *   { id: '2', name: 'Task 2.md', properties: { status: 'done', priority: 2 } },
 * ]);
 *
 * // Load base from YAML
 * const base = readBase(yamlString);
 *
 * // Create reactive query
 * const query = new ReactiveBaseQuery(source, base);
 *
 * // Access reactive results
 * const activeTasks = computed(() =>
 *   query.getViewResults('Active Tasks').value.items
 * );
 * ```
 */
export class ReactiveBaseQuery<T = void> {
  private source: Ref<BaseSource<T>[]>;
  private base: Ref<ObsidianBase>;
  private options: ReactiveBaseQueryOptions;
  private state: Ref<QueryState>;
  private formulaCache: Map<string, ComputedRef<unknown>> = new Map();

  constructor(
    source: Ref<BaseSource<T>[]> | BaseSource<T>[],
    base: ObsidianBase | Ref<ObsidianBase>,
    options: ReactiveBaseQueryOptions = {}
  ) {
    // Normalize source to ref
    this.source = Array.isArray(source) ? ref(source) as Ref<BaseSource<T>[]> : source;

    // Normalize base to ref
    this.base = 'value' in base ? base : ref(base);

    this.options = {
      immediate: true,
      debug: false,
      ...options,
    };

    this.state = ref({
      lastExecuted: 0,
      executionCount: 0,
      filterHash: '',
      sourceHash: '',
    });

    if (this.options.debug) {
      this.setupDebugWatcher();
    }
  }

  /**
   * Get the reactive source array
   */
  getSource(): Ref<BaseSource<T>[]> {
    return this.source;
  }

  /**
   * Set a new source array
   */
  setSource(newSource: BaseSource<T>[]): void {
    this.source.value = newSource;
  }

  /**
   * Get the base configuration
   */
  getBase(): Ref<ObsidianBase> {
    return this.base;
  }

  /**
   * Update the base configuration
   */
  setBase(newBase: ObsidianBase): void {
    this.base.value = newBase;
  }

  /**
   * Get computed results for a specific view
   */
  getViewResults(viewName: string): ComputedRef<ReactiveBaseQueryResult<T>> {
    return computed(() => {
      const view = this.findView(viewName);
      if (!view) {
        return this.createEmptyResult(null);
      }
      return this.executeQuery(view);
    });
  }

  /**
   * Get computed results for all items (global filters only)
   */
  getAllResults(): ComputedRef<ReactiveBaseQueryResult<T>> {
    return computed(() => {
      return this.executeQuery(null);
    });
  }

  /**
   * Get available view names
   */
  getViewNames(): ComputedRef<string[]> {
    return computed(() =>
      this.base.value.views.map(v => v.name)
    );
  }

  /**
   * Get a specific view configuration
   */
  getView(name: string): View | undefined {
    return this.findView(name);
  }

  /**
   * Get the current query state
   */
  getState(): Ref<QueryState> {
    return this.state;
  }

  /**
   * Force re-execution of the query
   */
  refresh(): void {
    this.state.value = {
      ...this.state.value,
      lastExecuted: Date.now(),
      executionCount: this.state.value.executionCount + 1,
    };
  }

  /**
   * Find a view by name
   */
  private findView(name: string): View | undefined {
    return this.base.value.views.find(v => v.name === name);
  }

  /**
   * Execute the query for a view
   */
  private executeQuery(view: View | null): ReactiveBaseQueryResult<T> {
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      // Combine global and view filters
      const combinedFilter = this.combineFilters(
        this.base.value.filters,
        view?.filters
      );

      // Apply filters
      let items = this.applyFilter(this.source.value, combinedFilter);

      // Apply formulas
      items = this.applyFormulas(items);

      // Apply sorting (from order property)
      if (view?.order) {
        items = this.applyOrder(items, view.order);
      }

      // Apply grouping
      let groups: Map<string, BaseSource<T>[]> | undefined;
      if (view?.groupBy) {
        groups = this.applyGroupBy(items, view.groupBy.property, view.groupBy.direction);
      }

      // Calculate summaries
      const summaries = view?.summaries
        ? this.calculateSummaries(items, view.summaries)
        : undefined;

      // Apply limit
      const totalCount = items.length;
      if (view?.limit && view.limit > 0) {
        items = items.slice(0, view.limit);
      }

      const endTime = performance.now();

      if (this.options.debug) {
        console.log(`[ReactiveBaseQuery] Query executed in ${(endTime - startTime).toFixed(2)}ms`, {
          view: view?.name || '(global)',
          totalCount,
          filteredCount: items.length,
        });
      }

      return {
        items,
        totalCount,
        groups,
        summaries,
        view,
        isProcessing: false,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      if (this.options.debug) {
        console.error('[ReactiveBaseQuery] Query error:', error);
      }

      return {
        items: [],
        totalCount: 0,
        view,
        isProcessing: false,
        errors,
      };
    }
  }

  /**
   * Create an empty result
   */
  private createEmptyResult(view: View | null): ReactiveBaseQueryResult<T> {
    return {
      items: [],
      totalCount: 0,
      view,
      isProcessing: false,
      errors: [],
    };
  }

  /**
   * Combine global and view filters
   */
  private combineFilters(globalFilter?: Filter, viewFilter?: Filter): Filter | undefined {
    if (!globalFilter && !viewFilter) return undefined;
    if (!globalFilter) return viewFilter;
    if (!viewFilter) return globalFilter;

    return {
      and: [globalFilter, viewFilter],
    };
  }

  /**
   * Apply filters to source items
   */
  private applyFilter(items: BaseSource<T>[], filter?: Filter): BaseSource<T>[] {
    if (!filter) return [...items];

    return items.filter(item => this.evaluateFilter(item, filter));
  }

  /**
   * Evaluate a filter against a single item
   */
  private evaluateFilter(item: BaseSource<T>, filter: Filter): boolean {
    if (typeof filter === 'string') {
      return this.evaluateFilterExpression(item, filter);
    }

    if ('and' in filter && filter.and) {
      return filter.and.every(f => this.evaluateFilter(item, f));
    }

    if ('or' in filter && filter.or) {
      return filter.or.some(f => this.evaluateFilter(item, f));
    }

    if ('not' in filter && filter.not) {
      return !filter.not.some(f => this.evaluateFilter(item, f));
    }

    return true;
  }

  /**
   * Evaluate a filter expression string against an item
   */
  private evaluateFilterExpression(item: BaseSource<T>, expression: string): boolean {
    try {
      const context = this.createExecutionContext(item);
      const parser = new FilterExpressionParser();
      const parsed = parser.parse(expression);

      if (!parsed.isValid || !parsed.ast) {
        return false;
      }

      const evaluator = new Evaluator(context);
      const result = evaluator.evaluate(parsed.ast);

      return this.isTruthy(result);
    } catch (error) {
      if (this.options.debug) {
        console.error('[ReactiveBaseQuery] Filter evaluation error:', error);
      }
      return false;
    }
  }

  /**
   * Create execution context for an item
   */
  private createExecutionContext(item: BaseSource<T>): ExecutionContext {
    const now = new Date();

    return {
      file: {
        name: item.name || '',
        basename: item.basename || '',
        path: item.path || '',
        folder: item.folder || '',
        ext: item.ext || '',
        size: item.size || 0,
        ctime: this.parseDate(item.ctime) || now,
        mtime: this.parseDate(item.mtime) || now,
        tags: item.tags || [],
        links: item.links || [],
        backlinks: item.backlinks || [],
        embeds: item.embeds || [],
        properties: item.properties || {},
      },
      note: item.properties || {},
      formula: {},
      this: {
        name: item.name || '',
        basename: item.basename || '',
        path: item.path || '',
        folder: item.folder || '',
        ext: item.ext || '',
        size: item.size || 0,
        ctime: this.parseDate(item.ctime) || now,
        mtime: this.parseDate(item.mtime) || now,
        tags: item.tags || [],
        links: item.links || [],
        backlinks: item.backlinks || [],
        embeds: item.embeds || [],
        properties: item.properties || {},
      },
      functions: {
        ...BUILTIN_FUNCTIONS,
        ...this.options.customFunctions,
      },
    };
  }

  /**
   * Parse a date value
   */
  private parseDate(value: Date | string | number | undefined): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  /**
   * Check if a runtime value is truthy
   */
  private isTruthy(value: RuntimeValue): boolean {
    switch (value.type) {
      case RuntimeValueType.NULL:
      case RuntimeValueType.UNDEFINED:
        return false;
      case RuntimeValueType.BOOLEAN:
        return value.value as boolean;
      case RuntimeValueType.NUMBER:
        return (value.value as number) !== 0;
      case RuntimeValueType.STRING:
        return (value.value as string).length > 0;
      case RuntimeValueType.LIST:
        return (value.value as unknown[]).length > 0;
      case RuntimeValueType.OBJECT:
        return Object.keys(value.value as object).length > 0;
      default:
        return true;
    }
  }

  /**
   * Apply formulas to items
   */
  private applyFormulas(items: BaseSource<T>[]): BaseSource<T>[] {
    const formulas = this.base.value.formulas;
    if (!formulas || Object.keys(formulas).length === 0) {
      return items;
    }

    return items.map(item => {
      const context = this.createExecutionContext(item);
      const formulaResults: Record<string, unknown> = {};

      for (const [name, expression] of Object.entries(formulas)) {
        try {
          const parser = new Parser(new Lexer(expression).tokenize());
          const result = parser.parse();

          if (result.success && result.ast) {
            const evaluator = new Evaluator(context);
            const value = evaluator.evaluate(result.ast);
            formulaResults[name] = value.value;
          }
        } catch (error) {
          if (this.options.debug) {
            console.error(`[ReactiveBaseQuery] Formula error for "${name}":`, error);
          }
        }
      }

      return {
        ...item,
        properties: {
          ...item.properties,
          ...formulaResults,
        },
      };
    });
  }

  /**
   * Apply ordering to items
   */
  private applyOrder(items: BaseSource<T>[], order: string[]): BaseSource<T>[] {
    return [...items].sort((a, b) => {
      for (const prop of order) {
        const aVal = this.getPropertyValue(a, prop);
        const bVal = this.getPropertyValue(b, prop);

        const comparison = this.compareValues(aVal, bVal);
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  }

  /**
   * Apply grouping to items
   */
  private applyGroupBy(
    items: BaseSource<T>[],
    property: string,
    direction: SortDirection
  ): Map<string, BaseSource<T>[]> {
    const groups = new Map<string, BaseSource<T>[]>();

    for (const item of items) {
      const value = this.getPropertyValue(item, property);
      const key = String(value ?? 'undefined');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    // Sort groups by key
    const sortedGroups = new Map([...groups.entries()].sort((a, b) => {
      const comparison = this.compareValues(a[0], b[0]);
      return direction === 'DESC' ? -comparison : comparison;
    }));

    return sortedGroups;
  }

  /**
   * Get property value from an item
   */
  private getPropertyValue(item: BaseSource<T>, property: string): unknown {
    // Handle prefixed properties
    if (property.startsWith('file.')) {
      const key = property.substring(5);
      return (item as Record<string, unknown>)[key];
    }

    if (property.startsWith('note.') || property.startsWith('properties.')) {
      const key = property.includes('.') ? property.split('.')[1] : property;
      return item.properties?.[key];
    }

    if (property.startsWith('formula.')) {
      const key = property.substring(8);
      return item.properties?.[key];
    }

    // Check item properties first
    if (item.properties?.[property] !== undefined) {
      return item.properties[property];
    }

    // Check item directly
    return (item as Record<string, unknown>)[property];
  }

  /**
   * Compare two values for sorting
   */
  private compareValues(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === undefined || a === null) return 1;
    if (b === undefined || b === null) return -1;

    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }

    return String(a).localeCompare(String(b));
  }

  /**
   * Calculate summaries for items
   */
  private calculateSummaries(
    items: BaseSource<T>[],
    summaries: Record<string, DefaultSummaryFormula | string>
  ): Record<string, unknown> {
    const results: Record<string, unknown> = {};

    for (const [property, summaryName] of Object.entries(summaries)) {
      const values = items.map(item => this.getPropertyValue(item, property));
      results[property] = this.calculateSummary(values, summaryName);
    }

    return results;
  }

  /**
   * Calculate a single summary
   */
  private calculateSummary(values: unknown[], summaryName: DefaultSummaryFormula | string): unknown {
    const numericValues = values.filter(v => typeof v === 'number') as number[];
    const dateValues = values.filter(v => v instanceof Date) as Date[];
    const booleanValues = values.filter(v => typeof v === 'boolean') as boolean[];

    switch (summaryName) {
      case 'Average':
        return numericValues.length > 0
          ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
          : null;

      case 'Min':
        return numericValues.length > 0 ? Math.min(...numericValues) : null;

      case 'Max':
        return numericValues.length > 0 ? Math.max(...numericValues) : null;

      case 'Sum':
        return numericValues.reduce((a, b) => a + b, 0);

      case 'Range':
        return numericValues.length > 0
          ? Math.max(...numericValues) - Math.min(...numericValues)
          : null;

      case 'Median':
        if (numericValues.length === 0) return null;
        const sorted = [...numericValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;

      case 'Earliest':
        return dateValues.length > 0
          ? new Date(Math.min(...dateValues.map(d => d.getTime())))
          : null;

      case 'Latest':
        return dateValues.length > 0
          ? new Date(Math.max(...dateValues.map(d => d.getTime())))
          : null;

      case 'Checked':
        return booleanValues.filter(v => v).length;

      case 'Unchecked':
        return booleanValues.filter(v => !v).length;

      case 'Empty':
        return values.filter(v => v === null || v === undefined || v === '').length;

      case 'Filled':
        return values.filter(v => v !== null && v !== undefined && v !== '').length;

      case 'Unique':
        return new Set(values.map(v => String(v))).size;

      default:
        // Custom summary - try to evaluate as formula
        return null;
    }
  }

  /**
   * Setup debug watcher
   */
  private setupDebugWatcher(): void {
    watch(
      [this.source, this.base],
      ([newSource, newBase], [oldSource, oldBase]) => {
        console.log('[ReactiveBaseQuery] Data changed:', {
          sourceChanged: newSource !== oldSource,
          baseChanged: newBase !== oldBase,
          sourceLength: newSource.length,
          viewCount: newBase.views.length,
        });
      },
      { deep: true }
    );
  }
}

// =============================================================================
// COMPOSABLES - Vue 3 Composition API
// =============================================================================

/**
 * Vue composable for reactive base queries.
 *
 * @example
 * ```typescript
 * // In a Vue component
 * const source = ref<BaseSource<Task>[]>([...]);
 * const base = readBase(yamlString);
 *
 * const { getViewResults, getAllResults, refresh } = useBaseQuery(source, base);
 *
 * // Get reactive results for a view
 * const activeTasks = getViewResults('Active Tasks');
 *
 * // Use in template
 * // <div v-for="task in activeTasks.value.items" :key="task.id">
 * //   {{ task.properties?.title }}
 * // </div>
 * ```
 */
export function useBaseQuery<T = void>(
  source: Ref<BaseSource<T>[]> | BaseSource<T>[],
  base: ObsidianBase | Ref<ObsidianBase>,
  options: ReactiveBaseQueryOptions = {}
) {
  const query = new ReactiveBaseQuery(source, base, options);

  return {
    /**
     * Reactive source array
     */
    source: query.getSource(),

    /**
     * Base configuration
     */
    base: query.getBase(),

    /**
     * Get computed results for a specific view
     */
    getViewResults: (viewName: string) => query.getViewResults(viewName),

    /**
     * Get computed results for all items (global filters only)
     */
    getAllResults: () => query.getAllResults(),

    /**
     * Get available view names
     */
    viewNames: query.getViewNames(),

    /**
     * Get a specific view configuration
     */
    getView: (name: string) => query.getView(name),

    /**
     * Query state
     */
    state: query.getState(),

    /**
     * Force refresh
     */
    refresh: () => query.refresh(),

    /**
     * Update source
     */
    setSource: (newSource: BaseSource<T>[]) => query.setSource(newSource),

    /**
     * Update base
     */
    setBase: (newBase: ObsidianBase) => query.setBase(newBase),
  };
}

/**
 * Vue composable for a single view query.
 * Simplified API when you only need one view.
 *
 * @example
 * ```typescript
 * const source = ref<BaseSource<Task>[]>([...]);
 * const base = readBase(yamlString);
 *
 * const { items, totalCount, groups, summaries, isProcessing } = useBaseView(
 *   source,
 *   base,
 *   'Active Tasks'
 * );
 *
 * // items is a ComputedRef - automatically updates when source changes
 * // Use in template: v-for="item in items" :key="item.id"
 * ```
 */
export function useBaseView<T = void>(
  source: Ref<BaseSource<T>[]> | BaseSource<T>[],
  base: ObsidianBase | Ref<ObsidianBase>,
  viewName: string,
  options: ReactiveBaseQueryOptions = {}
) {
  const query = new ReactiveBaseQuery(source, base, options);
  const results = query.getViewResults(viewName);

  return {
    /**
     * Filtered and sorted items
     */
    items: computed(() => results.value.items),

    /**
     * Total count before limit
     */
    totalCount: computed(() => results.value.totalCount),

    /**
     * Grouped items (if groupBy is specified)
     */
    groups: computed(() => results.value.groups),

    /**
     * Calculated summaries
     */
    summaries: computed(() => results.value.summaries),

    /**
     * View configuration
     */
    view: computed(() => results.value.view),

    /**
     * Whether the query is processing
     */
    isProcessing: computed(() => results.value.isProcessing),

    /**
     * Any errors
     */
    errors: computed(() => results.value.errors),

    /**
     * Full result object
     */
    result: results,

    /**
     * Force refresh
     */
    refresh: () => query.refresh(),

    /**
     * Source array
     */
    source: query.getSource(),

    /**
     * Base configuration
     */
    base: query.getBase(),
  };
}

// =============================================================================
// REACTIVE BASE - Reactive base object with modification methods
// =============================================================================

import { serializeToYAML } from './obsidian-bases-utils';
import type {
  FormulaExpression,
  SummaryExpression,
  FilterExpression,
} from './obsidian-bases-schema';

/**
 * Reactive base class that wraps an ObsidianBase with modification methods.
 * All changes are reactive and will automatically trigger re-evaluation in
 * ReactiveBaseQuery instances that use this base.
 *
 * @example
 * ```typescript
 * // Create a reactive base
 * const reactiveBase = createReactiveBase();
 *
 * // Add filters dynamically
 * reactiveBase.addFilter('file.hasTag("task")');
 *
 * // Add formulas
 * reactiveBase.addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)');
 *
 * // Add a view
 * reactiveBase.addTableView('Active Tasks', {
 *   order: ['file.name', 'formula.days_old'],
 *   filters: 'status != "done"',
 * });
 *
 * // Convert to YAML
 * const yaml = reactiveBase.toYAML();
 *
 * // Use with reactive query
 * const query = new ReactiveBaseQuery(source, reactiveBase.ref);
 * const results = query.getViewResults('Active Tasks');
 * ```
 */
export class ReactiveBase {
  private base: Ref<ObsidianBase>;

  constructor(initialBase?: ObsidianBase) {
    this.base = ref(initialBase || { views: [] });
  }

  /**
   * Get the reactive ref for use with ReactiveBaseQuery
   */
  get ref(): Ref<ObsidianBase> {
    return this.base;
  }

  /**
   * Get the current base value (readonly)
   */
  get value(): Readonly<ObsidianBase> {
    return this.base.value;
  }

  /**
   * Replace the entire base configuration
   */
  setBase(newBase: ObsidianBase): this {
    this.base.value = { ...newBase };
    return this;
  }

  /**
   * Load base from YAML string
   */
  fromYAML(yamlString: string): this {
    this.base.value = readBase(yamlString);
    return this;
  }

  /**
   * Convert the base to YAML string
   */
  toYAML(): string {
    return serializeToYAML(this.base.value);
  }

  // =============================================================================
  // FILTERS
  // =============================================================================

  /**
   * Set global filters (replaces existing)
   */
  setFilters(filters: Filter): this {
    this.base.value = {
      ...this.base.value,
      filters,
    };
    return this;
  }

  /**
   * Add a filter expression (AND with existing)
   */
  addFilter(filter: FilterExpression): this {
    const current = this.base.value.filters;

    if (!current) {
      this.base.value = {
        ...this.base.value,
        filters: filter,
      };
    } else if (typeof current === 'string') {
      this.base.value = {
        ...this.base.value,
        filters: {
          and: [current, filter],
        },
      };
    } else {
      const existing = current as FilterObject;
      if (existing.and) {
        this.base.value = {
          ...this.base.value,
          filters: {
            ...existing,
            and: [...existing.and, filter],
          },
        };
      } else {
        this.base.value = {
          ...this.base.value,
          filters: {
            and: [current, filter],
          },
        };
      }
    }

    return this;
  }

  /**
   * Clear all global filters
   */
  clearFilters(): this {
    this.base.value = {
      ...this.base.value,
      filters: undefined,
    };
    return this;
  }

  // =============================================================================
  // FORMULAS
  // =============================================================================

  /**
   * Add or update a formula
   */
  addFormula(name: string, expression: FormulaExpression): this {
    this.base.value = {
      ...this.base.value,
      formulas: {
        ...this.base.value.formulas,
        [name]: expression,
      },
    };
    return this;
  }

  /**
   * Remove a formula
   */
  removeFormula(name: string): this {
    if (!this.base.value.formulas) return this;

    const { [name]: removed, ...rest } = this.base.value.formulas;
    this.base.value = {
      ...this.base.value,
      formulas: rest,
    };
    return this;
  }

  /**
   * Set all formulas (replaces existing)
   */
  setFormulas(formulas: Record<string, FormulaExpression>): this {
    this.base.value = {
      ...this.base.value,
      formulas,
    };
    return this;
  }

  /**
   * Clear all formulas
   */
  clearFormulas(): this {
    this.base.value = {
      ...this.base.value,
      formulas: undefined,
    };
    return this;
  }

  // =============================================================================
  // PROPERTIES
  // =============================================================================

  /**
   * Configure a property's display settings
   */
  configureProperty(name: string, config: PropertyConfig): this {
    this.base.value = {
      ...this.base.value,
      properties: {
        ...this.base.value.properties,
        [name]: config,
      },
    };
    return this;
  }

  /**
   * Remove a property configuration
   */
  removePropertyConfig(name: string): this {
    if (!this.base.value.properties) return this;

    const { [name]: removed, ...rest } = this.base.value.properties;
    this.base.value = {
      ...this.base.value,
      properties: rest,
    };
    return this;
  }

  /**
   * Set all property configurations (replaces existing)
   */
  setProperties(properties: Record<string, PropertyConfig>): this {
    this.base.value = {
      ...this.base.value,
      properties,
    };
    return this;
  }

  /**
   * Clear all property configurations
   */
  clearProperties(): this {
    this.base.value = {
      ...this.base.value,
      properties: undefined,
    };
    return this;
  }

  // =============================================================================
  // SUMMARIES
  // =============================================================================

  /**
   * Add or update a custom summary formula
   */
  addSummary(name: string, expression: SummaryExpression): this {
    this.base.value = {
      ...this.base.value,
      summaries: {
        ...this.base.value.summaries,
        [name]: expression,
      },
    };
    return this;
  }

  /**
   * Remove a summary
   */
  removeSummary(name: string): this {
    if (!this.base.value.summaries) return this;

    const { [name]: removed, ...rest } = this.base.value.summaries;
    this.base.value = {
      ...this.base.value,
      summaries: rest,
    };
    return this;
  }

  /**
   * Set all summaries (replaces existing)
   */
  setSummaries(summaries: Record<string, SummaryExpression>): this {
    this.base.value = {
      ...this.base.value,
      summaries,
    };
    return this;
  }

  /**
   * Clear all summaries
   */
  clearSummaries(): this {
    this.base.value = {
      ...this.base.value,
      summaries: undefined,
    };
    return this;
  }

  // =============================================================================
  // VIEWS
  // =============================================================================

  /**
   * Add a view
   */
  addView(view: View): this {
    this.base.value = {
      ...this.base.value,
      views: [...this.base.value.views, view],
    };
    return this;
  }

  /**
   * Add a table view
   */
  addTableView(
    name: string,
    options: {
      order?: string[];
      filters?: Filter;
      limit?: number;
      groupBy?: { property: string; direction?: SortDirection };
      summaries?: Record<string, DefaultSummaryFormula | string>;
      sort?: SortConfig[];
      columnSize?: Record<string, number>;
    } = {}
  ): this {
    const view: View = {
      type: 'table',
      name,
      order: options.order,
      filters: options.filters,
      limit: options.limit,
      groupBy: options.groupBy
        ? { property: options.groupBy.property, direction: options.groupBy.direction || 'ASC' }
        : undefined,
      summaries: options.summaries,
      sort: options.sort,
      columnSize: options.columnSize,
    };
    return this.addView(view);
  }

  /**
   * Add a cards view
   */
  addCardsView(
    name: string,
    options: {
      order?: string[];
      filters?: Filter;
      limit?: number;
      groupBy?: { property: string; direction?: SortDirection };
      cardSize?: number;
      image?: ImageSource;
      imageFit?: ImageFit;
      imageAspectRatio?: number;
    } = {}
  ): this {
    const view: View = {
      type: 'cards',
      name,
      order: options.order,
      filters: options.filters,
      limit: options.limit,
      groupBy: options.groupBy
        ? { property: options.groupBy.property, direction: options.groupBy.direction || 'ASC' }
        : undefined,
      cardSize: options.cardSize,
      image: options.image,
      imageFit: options.imageFit,
      imageAspectRatio: options.imageAspectRatio,
    };
    return this.addView(view);
  }

  /**
   * Add a list view
   */
  addListView(
    name: string,
    options: {
      order?: string[];
      filters?: Filter;
      limit?: number;
      groupBy?: { property: string; direction?: SortDirection };
    } = {}
  ): this {
    const view: View = {
      type: 'list',
      name,
      order: options.order,
      filters: options.filters,
      limit: options.limit,
      groupBy: options.groupBy
        ? { property: options.groupBy.property, direction: options.groupBy.direction || 'ASC' }
        : undefined,
    };
    return this.addView(view);
  }

  /**
   * Add a map view
   */
  addMapView(
    name: string,
    options: {
      latProperty?: string;
      lngProperty?: string;
      titleProperty?: string;
      filters?: Filter;
      limit?: number;
    } = {}
  ): this {
    const view: View = {
      type: 'map',
      name,
      filters: options.filters,
      limit: options.limit,
      ...(options.latProperty && { latProperty: options.latProperty }),
      ...(options.lngProperty && { lngProperty: options.lngProperty }),
      ...(options.titleProperty && { titleProperty: options.titleProperty }),
    };
    return this.addView(view);
  }

  /**
   * Remove a view by name
   */
  removeView(name: string): this {
    this.base.value = {
      ...this.base.value,
      views: this.base.value.views.filter(v => v.name !== name),
    };
    return this;
  }

  /**
   * Update a view by name
   */
  updateView(name: string, updater: (view: View) => View): this {
    this.base.value = {
      ...this.base.value,
      views: this.base.value.views.map(v => v.name === name ? updater({ ...v }) : v),
    };
    return this;
  }

  /**
   * Get a view by name
   */
  getView(name: string): View | undefined {
    return this.base.value.views.find(v => v.name === name);
  }

  /**
   * Set view filters
   */
  setViewFilters(viewName: string, filters: Filter): this {
    return this.updateView(viewName, view => ({
      ...view,
      filters,
    }));
  }

  /**
   * Set view order
   */
  setViewOrder(viewName: string, order: string[]): this {
    return this.updateView(viewName, view => ({
      ...view,
      order,
    }));
  }

  /**
   * Set view limit
   */
  setViewLimit(viewName: string, limit: number | undefined): this {
    return this.updateView(viewName, view => ({
      ...view,
      limit,
    }));
  }

  /**
   * Set view groupBy
   */
  setViewGroupBy(viewName: string, groupBy: { property: string; direction: SortDirection } | undefined): this {
    return this.updateView(viewName, view => ({
      ...view,
      groupBy,
    }));
  }

  /**
   * Clear all views
   */
  clearViews(): this {
    this.base.value = {
      ...this.base.value,
      views: [],
    };
    return this;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Clone this reactive base
   */
  clone(): ReactiveBase {
    return new ReactiveBase(JSON.parse(JSON.stringify(this.base.value)));
  }

  /**
   * Reset to empty base
   */
  reset(): this {
    this.base.value = { views: [] };
    return this;
  }

  /**
   * Get a plain ObsidianBase object (non-reactive copy)
   */
  toObject(): ObsidianBase {
    return JSON.parse(JSON.stringify(this.base.value));
  }
}

// =============================================================================
// USE BASE COMPOSABLE - Unified base management
// =============================================================================

/**
 * Options for useBase composable
 */
export interface UseBaseOptions<T = void> {
  /** Initial source data */
  source?: Ref<BaseSource<T>[]> | BaseSource<T>[];
  /** Initial base configuration (object or YAML string) */
  base?: ObsidianBase | string;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom function resolvers */
  customFunctions?: Record<string, Function>;
  /** Track changes for hasChanges flag */
  trackChanges?: boolean;
}

/**
 * Return type for useBase composable
 */
export interface UseBaseReturn<T = void> {
  // ========== Base Management ==========
  /** Reactive base instance */
  base: ReactiveBase;
  /** Whether a base is loaded */
  isLoaded: Ref<boolean>;
  /** Whether the base has unsaved changes (if trackChanges enabled) */
  hasChanges: Ref<boolean>;
  
  // ========== Load/Save ==========
  /** Load base from YAML string */
  load: (yaml: string) => void;
  /** Load base from ObsidianBase object */
  loadFromObject: (base: ObsidianBase) => void;
  /** Save base to YAML string */
  save: () => string;
  /** Reset base to empty state */
  reset: () => void;
  /** Clone current base */
  clone: () => ReactiveBase;
  
  // ========== Source Data Management ==========
  /** Reactive source data */
  source: Ref<BaseSource<T>[]>;
  /** Replace entire source array */
  setSource: (newSource: BaseSource<T>[]) => void;
  /** Add item to source */
  addItem: (item: BaseSource<T>) => void;
  /** Remove item from source by id */
  removeItem: (id: string) => void;
  /** Update item in source */
  updateItem: (id: string, updates: Partial<BaseSource<T>>) => void;
  /** Clear all source items */
  clearSource: () => void;
  
  // ========== Query Access ==========
  /** Reactive query instance */
  query: ReactiveBaseQuery<T>;
  /** Get results for a specific view */
  getViewResults: (viewName: string) => ComputedRef<ReactiveBaseQueryResult<T>>;
  /** Get results for all items (global filters only) */
  getAllResults: () => ComputedRef<ReactiveBaseQueryResult<T>>;
  /** List of view names */
  viewNames: ComputedRef<string[]>;
  /** Force refresh query */
  refresh: () => void;
  
  // ========== View Management ==========
  /** All views (reactive) */
  views: ComputedRef<View[]>;
  /** Add a view */
  addView: (view: View) => void;
  /** Remove view by name */
  removeView: (name: string) => void;
  /** Get view by name */
  getView: (name: string) => View | undefined;
  /** Update view */
  updateView: (name: string, updater: (view: View) => View) => void;
  
  // ========== Formula Management ==========
  /** All formulas (reactive) */
  formulas: ComputedRef<Formulas | undefined>;
  /** Add or update formula */
  addFormula: (name: string, expression: string) => void;
  /** Remove formula */
  removeFormula: (name: string) => void;
  
  // ========== Filter Management ==========
  /** Global filters (reactive) */
  filters: ComputedRef<Filter | undefined>;
  /** Set global filters */
  setFilters: (filters: Filter) => void;
  /** Add filter (AND with existing) */
  addFilter: (filter: string) => void;
  /** Clear all filters */
  clearFilters: () => void;
  
  // ========== Property Management ==========
  /** All properties (reactive) */
  properties: ComputedRef<Properties | undefined>;
  /** Configure property */
  configureProperty: (name: string, config: PropertyConfig) => void;
  /** Remove property config */
  removePropertyConfig: (name: string) => void;
  
  // ========== Summary Management ==========
  /** All summaries (reactive) */
  summaries: ComputedRef<Summaries | undefined>;
  /** Add or update summary */
  addSummary: (name: string, expression: string) => void;
  /** Remove summary */
  removeSummary: (name: string) => void;
  
  // ========== State & Statistics ==========
  /** Computed state information */
  state: ComputedRef<{
    viewCount: number;
    formulaCount: number;
    propertyCount: number;
    summaryCount: number;
    itemCount: number;
    hasFilters: boolean;
    hasViews: boolean;
    hasFormulas: boolean;
  }>;
}

/**
 * Unified composable for managing an entire base instance.
 * 
 * Provides a complete reactive interface for loading, modifying, saving,
 * and querying a base configuration with its data.
 * 
 * @example
 * ```typescript
 * const { 
 *   base, 
 *   source, 
 *   load, 
 *   save, 
 *   addView, 
 *   getViewResults 
 * } = useBase<Task>({
 *   source: ref([...]),
 *   base: yamlString,
 * });
 * 
 * // Load from YAML
 * load(yamlString);
 * 
 * // Modify
 * base.addFormula('priority_label', 'if(priority == 1, "High", "Low")');
 * addView({ type: 'table', name: 'Tasks', order: ['file.name'] });
 * 
 * // Add data
 * source.value.push(newTask);
 * 
 * // Query
 * const tasks = getViewResults('Tasks');
 * 
 * // Save
 * const yaml = save();
 * await writeFile('config.base', yaml);
 * ```
 */
export function useBase<T = void>(options: UseBaseOptions<T> = {}): UseBaseReturn<T> {
  // Initialize source
  const source: Ref<BaseSource<T>[]> = Array.isArray(options.source) 
    ? ref(options.source) as Ref<BaseSource<T>[]>
    : (options.source as Ref<BaseSource<T>[]>) || ref<BaseSource<T>[]>([]);
  
  // Initialize base
  let initialBase: ObsidianBase;
  if (typeof options.base === 'string') {
    initialBase = readBase(options.base);
  } else if (options.base) {
    initialBase = options.base;
  } else {
    initialBase = { views: [] };
  }
  
  const reactiveBase = new ReactiveBase(initialBase);
  const isLoaded = ref(!!options.base);
  const hasChanges = ref(false);
  
  // Track changes if enabled
  if (options.trackChanges) {
    let initialYaml = serializeToYAML(initialBase);
    
    watch(
      () => reactiveBase.value,
      () => {
        const currentYaml = serializeToYAML(reactiveBase.value);
        hasChanges.value = currentYaml !== initialYaml;
      },
      { deep: true }
    );
  }
  
  // Create query
  const query = new ReactiveBaseQuery<T>(source, reactiveBase.ref, {
    debug: options.debug,
    customFunctions: options.customFunctions,
  });
  
  // Load/Save functions
  const load = (yaml: string) => {
    reactiveBase.fromYAML(yaml);
    isLoaded.value = true;
    if (options.trackChanges) {
      hasChanges.value = false;
    }
  };
  
  const loadFromObject = (base: ObsidianBase) => {
    reactiveBase.setBase(base);
    isLoaded.value = true;
    if (options.trackChanges) {
      hasChanges.value = false;
    }
  };
  
  const save = (): string => {
    const yaml = reactiveBase.toYAML();
    if (options.trackChanges) {
      hasChanges.value = false;
    }
    return yaml;
  };
  
  const reset = () => {
    reactiveBase.reset();
    isLoaded.value = false;
    if (options.trackChanges) {
      hasChanges.value = false;
    }
  };
  
  const clone = () => {
    return reactiveBase.clone();
  };
  
  // Source management
  const setSource = (newSource: BaseSource<T>[]) => {
    source.value = newSource;
  };
  
  const addItem = (item: BaseSource<T>) => {
    source.value = [...source.value, item];
  };
  
  const removeItem = (id: string) => {
    source.value = source.value.filter(item => item.id !== id);
  };
  
  const updateItem = (id: string, updates: Partial<BaseSource<T>>) => {
    const index = source.value.findIndex(item => item.id === id);
    if (index !== -1) {
      const updated = [...source.value];
      updated[index] = { ...updated[index], ...updates } as BaseSource<T>;
      source.value = updated;
    }
  };
  
  const clearSource = () => {
    source.value = [];
  };
  
  // Query access
  const getViewResults = (viewName: string) => query.getViewResults(viewName);
  const getAllResults = () => query.getAllResults();
  const viewNames = query.getViewNames();
  const refresh = () => query.refresh();
  
  // Computed properties
  const views = computed(() => reactiveBase.value.views);
  const formulas = computed(() => reactiveBase.value.formulas);
  const filters = computed(() => reactiveBase.value.filters);
  const properties = computed(() => reactiveBase.value.properties);
  const summaries = computed(() => reactiveBase.value.summaries);
  
  // State
  const state = computed(() => ({
    viewCount: reactiveBase.value.views.length,
    formulaCount: Object.keys(reactiveBase.value.formulas || {}).length,
    propertyCount: Object.keys(reactiveBase.value.properties || {}).length,
    summaryCount: Object.keys(reactiveBase.value.summaries || {}).length,
    itemCount: source.value.length,
    hasFilters: !!reactiveBase.value.filters,
    hasViews: reactiveBase.value.views.length > 0,
    hasFormulas: Object.keys(reactiveBase.value.formulas || {}).length > 0,
  }));
  
  return {
    // Base management
    base: reactiveBase,
    isLoaded,
    hasChanges,
    
    // Load/Save
    load,
    loadFromObject,
    save,
    reset,
    clone,
    
    // Source management
    source,
    setSource,
    addItem,
    removeItem,
    updateItem,
    clearSource,
    
    // Query access
    query,
    getViewResults,
    getAllResults,
    viewNames,
    refresh,
    
    // View management
    views,
    addView: (view: View) => reactiveBase.addView(view),
    removeView: (name: string) => reactiveBase.removeView(name),
    getView: (name: string) => reactiveBase.getView(name),
    updateView: (name: string, updater: (view: View) => View) => 
      reactiveBase.updateView(name, updater),
    
    // Formula management
    formulas,
    addFormula: (name: string, expression: string) => 
      reactiveBase.addFormula(name, expression),
    removeFormula: (name: string) => reactiveBase.removeFormula(name),
    
    // Filter management
    filters,
    setFilters: (filters: Filter) => reactiveBase.setFilters(filters),
    addFilter: (filter: string) => reactiveBase.addFilter(filter),
    clearFilters: () => reactiveBase.clearFilters(),
    
    // Property management
    properties,
    configureProperty: (name: string, config: PropertyConfig) => 
      reactiveBase.configureProperty(name, config),
    removePropertyConfig: (name: string) => 
      reactiveBase.removePropertyConfig(name),
    
    // Summary management
    summaries,
    addSummary: (name: string, expression: string) => 
      reactiveBase.addSummary(name, expression),
    removeSummary: (name: string) => reactiveBase.removeSummary(name),
    
    // State
    state,
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Create a new reactive base
 *
 * @example
 * ```typescript
 * const base = createReactiveBase();
 * base.addFilter('file.hasTag("task")')
 *     .addFormula('days_old', '((now() - file.ctime) / 86400000).round(0)')
 *     .addTableView('Tasks', { order: ['file.name'] });
 * ```
 */
export function createReactiveBase(initialBase?: ObsidianBase): ReactiveBase {
  return new ReactiveBase(initialBase);
}

/**
 * Create a reactive base from YAML
 *
 * @example
 * ```typescript
 * const yaml = `
 *   filters:
 *     and:
 *       - file.hasTag("task")
 *   views:
 *     - type: table
 *       name: "Tasks"
 * `;
 * const base = createReactiveBaseFromYAML(yaml);
 * ```
 */
export function createReactiveBaseFromYAML(yamlString: string): ReactiveBase {
  const base = readBase(yamlString);
  return new ReactiveBase(base);
}

/**
 * Create a reactive base query from YAML.
 *
 * @example
 * ```typescript
 * const yaml = `
 *   filters:
 *     and:
 *       - file.hasTag("task")
 *   views:
 *     - type: table
 *       name: "Tasks"
 *       order:
 *         - file.name
 * `;
 *
 * const source = ref<BaseSource[]>([...]);
 * const query = createBaseQueryFromYAML(source, yaml);
 *
 * const tasks = query.getViewResults('Tasks');
 * ```
 */
export function createBaseQueryFromYAML<T = void>(
  source: Ref<BaseSource<T>[]> | BaseSource<T>[],
  yamlString: string,
  options: ReactiveBaseQueryOptions = {}
): ReactiveBaseQuery<T> {
  const base = readBase(yamlString);
  return new ReactiveBaseQuery(source, base, options);
}

/**
 * Create a reactive base query from a base object.
 *
 * @example
 * ```typescript
 * const base: ObsidianBase = {
 *   filters: { and: ['file.hasTag("task")'] },
 *   views: [{ type: 'table', name: 'Tasks', order: ['file.name'] }],
 * };
 *
 * const source = ref<BaseSource[]>([...]);
 * const query = createBaseQuery(source, base);
 * ```
 */
export function createBaseQuery<T = void>(
  source: Ref<BaseSource<T>[]> | BaseSource<T>[],
  base: ObsidianBase | Ref<ObsidianBase>,
  options: ReactiveBaseQueryOptions = {}
): ReactiveBaseQuery<T> {
  return new ReactiveBaseQuery(source, base, options);
}
