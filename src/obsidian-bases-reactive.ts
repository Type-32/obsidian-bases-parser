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
  DefaultSummaryFormula,
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

/**
 * Parse a YAML string into an ObsidianBase object.
 * This is a lightweight YAML parser for Obsidian Bases.
 */
export function readBase(yamlString: string): ObsidianBase {
  const lines = yamlString.split('\n');
  const result: Partial<ObsidianBase> = { views: [] };

  let currentSection: string | null = null;
  let currentView: Partial<View> | null = null;
  let currentSubSection: string | null = null;
  let indentStack: Array<{ key: string; obj: Record<string, unknown> }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    const isListItem = trimmed.startsWith('- ');

    // Top-level sections
    if (indent === 0 && !isListItem) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      if (key === 'filters') {
        currentSection = 'filters';
        result.filters = value ? parseInlineFilter(value) : undefined;
      } else if (key === 'formulas') {
        currentSection = 'formulas';
        result.formulas = {};
      } else if (key === 'properties') {
        currentSection = 'properties';
        result.properties = {};
      } else if (key === 'summaries') {
        currentSection = 'summaries';
        result.summaries = {};
      } else if (key === 'views') {
        currentSection = 'views';
      } else if (currentSection === 'formulas' && result.formulas) {
        result.formulas[key] = parseYamlValue(value);
      } else if (currentSection === 'summaries' && result.summaries) {
        result.summaries[key] = parseYamlValue(value);
      }

      continue;
    }

    // Handle filters section
    if (currentSection === 'filters') {
      if (indent === 2 && !isListItem) {
        // and:, or:, not:
        const key = trimmed.replace(':', '');
        if (['and', 'or', 'not'].includes(key)) {
          result.filters = parseFilterBlock(lines, i, key) as Filter;
          // Skip processed lines
          const blockEnd = findBlockEnd(lines, i);
          i = blockEnd;
        }
      }
      continue;
    }

    // Handle formulas section
    if (currentSection === 'formulas' && result.formulas) {
      if (indent === 2 && !isListItem) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        result.formulas[key] = parseYamlValue(value) || parseMultilineValue(lines, i);
      }
      continue;
    }

    // Handle properties section
    if (currentSection === 'properties' && result.properties) {
      if (indent === 2 && !isListItem) {
        const propName = trimmed.replace(':', '');
        result.properties[propName] = {};
        indentStack = [{ key: propName, obj: result.properties[propName] }];
      } else if (indent === 4 && indentStack.length > 0) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        indentStack[0].obj[key] = parseYamlValue(value);
      }
      continue;
    }

    // Handle views section
    if (currentSection === 'views') {
      if (isListItem && indent === 2) {
        // Start new view
        currentView = {};
        result.views!.push(currentView as View);

        const content = trimmed.substring(2).trim();
        if (content) {
          // Inline view properties
          const [key, value] = content.split(':');
          if (key && value) {
            (currentView as Record<string, unknown>)[key.trim()] = parseYamlValue(value.trim());
          }
        }
      } else if (currentView && indent >= 4) {
        // View properties
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();

        if (key === 'groupBy') {
          currentView.groupBy = { property: '', direction: 'ASC' };
          indentStack = [{ key: 'groupBy', obj: currentView.groupBy as unknown as Record<string, unknown> }];
        } else if (key === 'filters') {
          currentView.filters = parseFilterBlock(lines, i, 'and') as Filter;
          const blockEnd = findBlockEnd(lines, i);
          i = blockEnd;
        } else if (key === 'order') {
          currentView.order = parseStringArray(lines, i);
          const blockEnd = findArrayEnd(lines, i);
          i = blockEnd;
        } else if (key === 'summaries') {
          currentView.summaries = parseSummariesBlock(lines, i);
          const blockEnd = findBlockEnd(lines, i);
          i = blockEnd;
        } else if (indent === 4) {
          (currentView as Record<string, unknown>)[key] = parseYamlValue(value);
        } else if (indent === 6 && indentStack.length > 0) {
          indentStack[0].obj[key] = parseYamlValue(value);
        }
      }
    }
  }

  return result as ObsidianBase;
}

/**
 * Parse an inline filter string
 */
function parseInlineFilter(value: string): Filter {
  return value.replace(/^["']|["']$/g, '');
}

/**
 * Parse a YAML value (string, number, boolean)
 */
function parseYamlValue(value: string): unknown {
  value = value.trim();

  if (!value) return undefined;

  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Null
  if (value === 'null' || value === '~') return null;

  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  return value;
}

/**
 * Parse a multiline YAML value
 */
function parseMultilineValue(lines: string[], startIndex: number): string {
  const values: string[] = [];
  const baseIndent = lines[startIndex].search(/\S/);

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    const indent = line.search(/\S/);
    if (indent <= baseIndent) break;

    values.push(trimmed);
  }

  return values.join(' ');
}

/**
 * Parse a filter block (and, or, not)
 */
function parseFilterBlock(lines: string[], startIndex: number, operator: string): FilterObject {
  const result: FilterObject = { [operator]: [] };
  const baseIndent = lines[startIndex].search(/\S/);

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);

    // End of block
    if (indent <= baseIndent) break;

    // List item (filter expression)
    if (trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim();
      (result[operator as keyof FilterObject] as string[]).push(
        parseYamlValue(value) as string
      );
    }
    // Nested filter object
    else if (!trimmed.includes(':') || trimmed.endsWith(':')) {
      const nestedOp = trimmed.replace(':', '');
      if (['and', 'or', 'not'].includes(nestedOp)) {
        const nestedBlock = parseFilterBlock(lines, i, nestedOp);
        (result[operator as keyof FilterObject] as FilterObject[]).push(nestedBlock);
        i = findBlockEnd(lines, i);
      }
    }
  }

  return result;
}

/**
 * Parse string array (order property)
 */
function parseStringArray(lines: string[], startIndex: number): string[] {
  const result: string[] = [];
  const baseIndent = lines[startIndex].search(/\S/);

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    if (indent <= baseIndent) break;

    if (trimmed.startsWith('- ')) {
      result.push(parseYamlValue(trimmed.substring(2).trim()) as string);
    }
  }

  return result;
}

/**
 * Parse summaries block
 */
function parseSummariesBlock(lines: string[], startIndex: number): Record<string, string> {
  const result: Record<string, string> = {};
  const baseIndent = lines[startIndex].search(/\S/);

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    if (indent <= baseIndent) break;

    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();
    result[key] = parseYamlValue(value) as string;
  }

  return result;
}

/**
 * Find the end of a YAML block
 */
function findBlockEnd(lines: string[], startIndex: number): number {
  const baseIndent = lines[startIndex].search(/\S/);

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    if (indent <= baseIndent) {
      return i - 1;
    }
  }

  return lines.length - 1;
}

/**
 * Find the end of an array
 */
function findArrayEnd(lines: string[], startIndex: number): number {
  return findBlockEnd(lines, startIndex);
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
    this.source = Array.isArray(source) ? ref(source) : source;

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
          const expr = typeof expression === 'string' ? expression : expression.raw;
          const parser = new Parser(new Lexer(expr).tokenize());
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
// CONVENIENCE EXPORTS
// =============================================================================

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
