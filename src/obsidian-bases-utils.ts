/**
 * Obsidian Bases Utility Functions
 *
 * Helper functions for working with Obsidian Bases, including:
 * - YAML serialization/deserialization
 * - Base file creation and manipulation
 * - Property path resolution
 * - Filter composition
 */

import {
  ObsidianBase,
  Filter,
  FilterObject,
  View,
  ViewType,
  Formulas,
  Properties,
  Summaries,
  PropertyConfig,
  GroupByConfig,
  ViewSummaries,
  DefaultSummaryFormula,
  SortDirection,
  SortConfig,
  FilterExpression,
  FormulaExpression,
  SummaryExpression,
  ImageFit,
  ImageSource,
} from './obsidian-bases-schema';

// =============================================================================
// BASE BUILDER - Fluent API for creating bases
// =============================================================================

/**
 * Builder class for creating Obsidian Base files
 */
export class BaseBuilder {
  private base: ObsidianBase;

  constructor() {
    this.base = { views: [] };
  }

  /**
   * Set global filters for the base
   */
  withFilters(filters: Filter): this {
    this.base.filters = filters;
    return this;
  }

  /**
   * Add a single filter expression to global filters (AND with existing)
   */
  addFilter(filter: FilterExpression): this {
    if (!this.base.filters) {
      this.base.filters = filter;
    } else if (typeof this.base.filters === 'string') {
      this.base.filters = {
        and: [this.base.filters, filter],
      };
    } else {
      const existing = this.base.filters as FilterObject;
      if (existing.and) {
        existing.and.push(filter);
      } else {
        this.base.filters = {
          and: [this.base.filters, filter],
        };
      }
    }
    return this;
  }

  /**
   * Add a formula property
   */
  addFormula(name: string, expression: FormulaExpression): this {
    if (!this.base.formulas) {
      this.base.formulas = {};
    }
    this.base.formulas[name] = expression;
    return this;
  }

  /**
   * Set all formulas at once
   */
  withFormulas(formulas: Formulas): this {
    this.base.formulas = formulas;
    return this;
  }

  /**
   * Configure a property's display name
   */
  configureProperty(name: string, config: PropertyConfig): this {
    if (!this.base.properties) {
      this.base.properties = {};
    }
    this.base.properties[name] = config;
    return this;
  }

  /**
   * Set all properties at once
   */
  withProperties(properties: Properties): this {
    this.base.properties = properties;
    return this;
  }

  /**
   * Add a custom summary formula
   */
  addSummary(name: string, expression: SummaryExpression): this {
    if (!this.base.summaries) {
      this.base.summaries = {};
    }
    this.base.summaries[name] = expression;
    return this;
  }

  /**
   * Set all summaries at once
   */
  withSummaries(summaries: Summaries): this {
    this.base.summaries = summaries;
    return this;
  }

  /**
   * Add a view
   */
  addView(view: View): this {
    this.base.views.push(view);
    return this;
  }

  /**
   * Create and add a table view
   */
  addTableView(
    name: string,
    options: {
      order?: string[];
      filters?: Filter;
      limit?: number;
      groupBy?: { property: string; direction?: SortDirection };
      summaries?: ViewSummaries;
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
   * Create and add a cards view
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
   * Create and add a list view
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
   * Create and add a map view
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
      // Map-specific properties stored as extension
      ...(options.latProperty && { latProperty: options.latProperty }),
      ...(options.lngProperty && { lngProperty: options.lngProperty }),
      ...(options.titleProperty && { titleProperty: options.titleProperty }),
    };
    return this.addView(view);
  }

  /**
   * Build and return the base object
   */
  build(): ObsidianBase {
    return { ...this.base };
  }
}

// =============================================================================
// FILTER BUILDER - Fluent API for building complex filters
// =============================================================================

/**
 * Builder class for creating complex filter expressions
 */
export class FilterBuilder {
  private filter: Filter;

  constructor(initialFilter?: Filter) {
    this.filter = initialFilter || { and: [] };
  }

  /**
   * Create a new filter builder starting with an AND group
   */
  static and(...filters: Filter[]): FilterBuilder {
    return new FilterBuilder({ and: filters });
  }

  /**
   * Create a new filter builder starting with an OR group
   */
  static or(...filters: Filter[]): FilterBuilder {
    return new FilterBuilder({ or: filters });
  }

  /**
   * Create a new filter builder starting with a NOT group
   */
  static not(...filters: Filter[]): FilterBuilder {
    return new FilterBuilder({ not: filters });
  }

  /**
   * Add a condition that must be true (AND)
   */
  and(filter: Filter): this {
    if (typeof this.filter === 'string') {
      this.filter = { and: [this.filter, filter] };
    } else {
      const obj = this.filter as FilterObject;
      if (obj.and) {
        obj.and.push(filter);
      } else {
        this.filter = { and: [this.filter, filter] };
      }
    }
    return this;
  }

  /**
   * Add a condition that can be true (OR)
   */
  or(filter: Filter): this {
    if (typeof this.filter === 'string') {
      this.filter = { or: [this.filter, filter] };
    } else {
      const obj = this.filter as FilterObject;
      if (obj.or) {
        obj.or.push(filter);
      } else {
        this.filter = { or: [this.filter, filter] };
      }
    }
    return this;
  }

  /**
   * Add a condition that must NOT be true (NOT)
   */
  not(filter: Filter): this {
    if (typeof this.filter === 'string') {
      this.filter = { not: [this.filter, filter] };
    } else {
      const obj = this.filter as FilterObject;
      if (obj.not) {
        obj.not.push(filter);
      } else {
        this.filter = { not: [this.filter, filter] };
      }
    }
    return this;
  }

  /**
   * Build and return the filter
   */
  build(): Filter {
    return this.filter;
  }
}

// =============================================================================
// PRESET FILTERS - Common filter patterns
// =============================================================================

/**
 * Preset filters for common use cases
 */
export const PresetFilters = {
  /**
   * Filter by file extension
   */
  byExtension: (ext: string): FilterExpression => `file.ext == "${ext}"`,

  /**
   * Filter by tag
   */
  byTag: (tag: string): FilterExpression => `file.hasTag("${tag}")`,

  /**
   * Filter by multiple tags (any)
   */
  byAnyTag: (...tags: string[]): FilterExpression =>
    tags.length === 1
      ? `file.hasTag("${tags[0]}")`
      : `or: [${tags.map(t => `file.hasTag("${t}")`).join(', ')}]`,

  /**
   * Filter by folder
   */
  inFolder: (folder: string): FilterExpression => `file.inFolder("${folder}")`,

  /**
   * Filter by property value
   */
  byProperty: (property: string, value: string | number | boolean): FilterExpression => {
    const val = typeof value === 'string' ? `"${value}"` : String(value);
    return `${property} == ${val}`;
  },

  /**
   * Filter by property existence
   */
  hasProperty: (property: string): FilterExpression => `file.hasProperty("${property}")`,

  /**
   * Filter by date range (modified within last N days)
   */
  modifiedWithin: (days: number): FilterExpression =>
    `file.mtime > now() - "${days}d"`,

  /**
   * Filter by created date range
   */
  createdWithin: (days: number): FilterExpression =>
    `file.ctime > now() - "${days}d"`,

  /**
   * Filter by link to file
   */
  hasLink: (filename: string): FilterExpression => `file.hasLink("${filename}")`,

  /**
   * Filter by name pattern (using regex)
   */
  nameMatches: (pattern: string): FilterExpression =>
    `/${pattern}/.matches(file.name)`,

  /**
   * Filter by status property
   */
  byStatus: (status: string): FilterExpression => `status == "${status}"`,

  /**
   * Combine multiple filters with AND
   */
  all: (...filters: Filter[]): Filter => ({ and: filters }),

  /**
   * Combine multiple filters with OR
   */
  any: (...filters: Filter[]): Filter => ({ or: filters }),

  /**
   * Negate a filter
   */
  none: (...filters: Filter[]): Filter => ({ not: filters }),
};

// =============================================================================
// PRESET FORMULAS - Common formula patterns
// =============================================================================

/**
 * Preset formulas for common use cases
 */
export const PresetFormulas = {
  /**
   * Calculate days until a due date
   */
  daysUntilDue: (dueProperty = 'due'): FormulaExpression =>
    `if(${dueProperty}, ((date(${dueProperty}) - today()) / 86400000).round(0), "")`,

  /**
   * Check if overdue
   */
  isOverdue: (dueProperty = 'due', statusProperty = 'status', doneValue = 'done'): FormulaExpression =>
    `if(${dueProperty}, date(${dueProperty}) < today() && ${statusProperty} != "${doneValue}", false)`,

  /**
   * Format a date property
   */
  formatDate: (dateProperty: string, format = 'YYYY-MM-DD'): FormulaExpression =>
    `${dateProperty}.format("${format}")`,

  /**
   * Get relative time since modification
   */
  lastModified: (): FormulaExpression =>
    'file.mtime.relative()',

  /**
   * Count links in a file
   */
  linkCount: (): FormulaExpression =>
    'file.links.length',

  /**
   * Priority label with icons
   */
  priorityLabel: (
    priorityProperty = 'priority',
    levels: { value: number; label: string; icon?: string }[] = [
      { value: 1, label: 'High', icon: '🔴' },
      { value: 2, label: 'Medium', icon: '🟡' },
      { value: 3, label: 'Low', icon: '🟢' },
    ]
  ): FormulaExpression => {
    const buildIf = (index: number): string => {
      const level = levels[index];
      const iconPrefix = level.icon ? `${level.icon} ` : '';
      if (index === levels.length - 1) {
        return `"${iconPrefix}${level.label}"`;
      }
      return `if(${priorityProperty} == ${level.value}, "${iconPrefix}${level.label}", ${buildIf(index + 1)})`;
    };
    return buildIf(0);
  },

  /**
   * Status icon
   */
  statusIcon: (
    statusProperty = 'status',
    mapping: Record<string, string> = { done: '✅', progress: '⏳', todo: '⏸️' }
  ): FormulaExpression => {
    const entries = Object.entries(mapping);
    const buildIf = (index: number): string => {
      const [status, icon] = entries[index];
      if (index === entries.length - 1) {
        return `"${icon}"`;
      }
      return `if(${statusProperty} == "${status}", "${icon}", ${buildIf(index + 1)})`;
    };
    return buildIf(0);
  },

  /**
   * Format currency
   */
  formatCurrency: (amountProperty: string, currency = '$'): FormulaExpression =>
    `if(${amountProperty}, "${currency}" + ${amountProperty}.toFixed(2), "")`,

  /**
   * Calculate total
   */
  total: (priceProperty: string, quantityProperty: string): FormulaExpression =>
    `${priceProperty} * ${quantityProperty}`,

  /**
   * Word count estimate from file size
   */
  wordEstimate: (): FormulaExpression =>
    '(file.size / 5).round(0)',

  /**
   * Days old since creation
   */
  daysOld: (): FormulaExpression =>
    '((now() - file.ctime) / 86400000).round(0)',

  /**
   * Day of week from date
   */
  dayOfWeek: (dateProperty: string): FormulaExpression =>
    `date(${dateProperty}).format("dddd")`,

  /**
   * Reading time estimate
   */
  readingTime: (pagesProperty: string, minutesPerPage = 2): FormulaExpression =>
    `if(${pagesProperty}, (${pagesProperty} * ${minutesPerPage}).toString() + " min", "")`,
};

// =============================================================================
// PRESET SUMMARIES - Common summary patterns
// =============================================================================

/**
 * Preset summary formulas
 */
export const PresetSummaries = {
  /**
   * Custom average with rounding
   */
  customAverage: (decimalPlaces = 2): SummaryExpression =>
    `values.filter(value.isType("number")).mean().round(${decimalPlaces})`,

  /**
   * Sum with rounding
   */
  customSum: (decimalPlaces = 2): SummaryExpression =>
    `values.filter(value.isType("number")).sum().round(${decimalPlaces})`,

  /**
   * Count non-empty values
   */
  countFilled: (): SummaryExpression =>
    'values.filter(v => !v.isEmpty()).length',

  /**
   * Percentage of true values
   */
  percentTrue: (): SummaryExpression =>
    '(values.filter(v => v == true).length / values.length * 100).round(1) + "%"',

  /**
   * Concatenate unique values
   */
  uniqueJoin: (separator = ', '): SummaryExpression =>
    `values.unique().join("${separator}")`,
};

// =============================================================================
// PROPERTY PATH UTILITIES
// =============================================================================

/**
 * Parse a property path into prefix and name
 */
export function parsePropertyPath(path: string): { prefix?: string; name: string } {
  const parts = path.split('.');

  if (parts.length > 1 && ['note', 'file', 'formula', 'this'].includes(parts[0])) {
    return {
      prefix: parts[0],
      name: parts.slice(1).join('.'),
    };
  }

  return { name: path };
}

/**
 * Build a property path from prefix and name
 */
export function buildPropertyPath(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

/**
 * Normalize a property path (ensure proper prefix)
 */
export function normalizePropertyPath(
  path: string,
  defaultPrefix: 'note' | 'file' | 'formula' = 'note'
): string {
  const { prefix, name } = parsePropertyPath(path);
  return buildPropertyPath(prefix || defaultPrefix, name);
}

// =============================================================================
// YAML SERIALIZATION
// =============================================================================

import * as yaml from 'js-yaml';

/**
 * Serialize a base to YAML string using js-yaml
 */
export function serializeToYAML(base: ObsidianBase): string {
  try {
    // Create a clean object for serialization
    const cleanBase: Partial<ObsidianBase> = {};
    
    // Only include properties that have values
    if (base.filters) {
      cleanBase.filters = base.filters;
    }
    
    if (base.formulas && Object.keys(base.formulas).length > 0) {
      cleanBase.formulas = base.formulas;
    }
    
    if (base.properties && Object.keys(base.properties).length > 0) {
      cleanBase.properties = base.properties;
    }
    
    if (base.summaries && Object.keys(base.summaries).length > 0) {
      cleanBase.summaries = base.summaries;
    }
    
    if (base.views && base.views.length > 0) {
      cleanBase.views = base.views;
    }
    
    // Serialize using js-yaml with nice formatting
    return yaml.dump(cleanBase, {
      indent: 2,
      lineWidth: -1, // Don't wrap lines
      noRefs: true,  // Don't use YAML references
      sortKeys: false, // Preserve key order
      quotingType: '"', // Use double quotes
      forceQuotes: false, // Only quote when necessary
    });
  } catch (error) {
    throw new Error(`Failed to serialize to YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Create a new base builder
 */
export function createBase(): BaseBuilder {
  return new BaseBuilder();
}

/**
 * Create a new filter builder
 */
export function createFilter(initialFilter?: Filter): FilterBuilder {
  return new FilterBuilder(initialFilter);
}

/**
 * Create a filter builder starting with AND
 */
export function and(...filters: Filter[]): FilterBuilder {
  return FilterBuilder.and(...filters);
}

/**
 * Create a filter builder starting with OR
 */
export function or(...filters: Filter[]): FilterBuilder {
  return FilterBuilder.or(...filters);
}

/**
 * Create a filter builder starting with NOT
 */
export function not(...filters: Filter[]): FilterBuilder {
  return FilterBuilder.not(...filters);
}
