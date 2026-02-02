/**
 * Obsidian Bases (.base files) TypeScript Schema
 * Based on: https://help.obsidian.md/bases
 *
 * This module provides complete type definitions for Obsidian Bases,
 * including filters, formulas, views, and all related configurations.
 */

// =============================================================================
// REACTIVE BASE QUERY SYSTEM
// =============================================================================

/**
 * Base source item - the input data type for reactive queries.
 * Contains optional Obsidian-specific fields plus user-defined data.
 */
export interface BaseSource<T = void> {
  /** Unique identifier for the item */
  id?: string;

  /** File name (e.g., "My Note.md") */
  name?: string;

  /** File name without extension (e.g., "My Note") */
  basename?: string;

  /** Full path to the file (e.g., "Notes/My Note.md") */
  path?: string;

  /** Parent folder path (e.g., "Notes") */
  folder?: string;

  /** File extension (e.g., "md") */
  ext?: string;

  /** File size in bytes */
  size?: number;

  /** Created time */
  ctime?: Date | string | number;

  /** Modified time */
  mtime?: Date | string | number;

  /** Tags associated with the item */
  tags?: string[];

  /** Internal links */
  links?: string[];

  /** Backlinks (files linking to this item) */
  backlinks?: string[];

  /** Embeds in the content */
  embeds?: string[];

  /** Frontmatter/note properties */
  properties?: Record<string, unknown>;

  /** User-defined custom data */
  data?: T;
}

/**
 * Options for reactive base queries
 */
export interface ReactiveBaseQueryOptions {
  /** Whether to enable debug logging */
  debug?: boolean;

  /** Custom function resolvers */
  customFunctions?: Record<string, Function>;

  /** Whether to recalculate formulas on every change (default: true) */
  immediate?: boolean;
}

/**
 * Result of a reactive base query
 */
export interface ReactiveBaseQueryResult<T> {
  /** Filtered and sorted items */
  items: BaseSource<T>[];

  /** Total count before limit */
  totalCount: number;

  /** Grouped items (if groupBy is specified) */
  groups?: Map<string, BaseSource<T>[]>;

  /** Calculated summaries */
  summaries?: Record<string, unknown>;

  /** Current view configuration */
  view: View | null;

  /** Whether the query is currently processing */
  isProcessing: boolean;

  /** Any errors that occurred */
  errors: string[];
}

/**
 * Reactive query state for tracking changes
 */
export interface QueryState {
  /** Last execution timestamp */
  lastExecuted: number;

  /** Execution count */
  executionCount: number;

  /** Current filter hash for change detection */
  filterHash: string;

  /** Current source hash for change detection */
  sourceHash: string;
}

// =============================================================================
// FILTER SYSTEM
// =============================================================================

/**
 * Comparison operators for filter expressions
 */
export type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

/**
 * Boolean operators for combining filter expressions
 */
export type BooleanOperator = '&&' | '||' | '!';

/**
 * Arithmetic operators for formula expressions
 */
export type ArithmeticOperator = '+' | '-' | '*' | '/' | '%';

/**
 * Sort direction for grouping and ordering
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Sort configuration for a property
 */
export interface SortConfig {
  /** Property to sort by */
  property: string;
  /** Sort direction */
  direction: SortDirection;
}

/**
 * Image fit modes for cards/gallery views
 */
export type ImageFit = 'cover' | 'contain' | 'fill' | '';

/**
 * Image source for cards/gallery views
 */
export type ImageSource = 'cover' | 'first' | string;

/**
 * View types supported by Obsidian Bases
 */
export type ViewType = 'table' | 'cards' | 'list' | 'map';

/**
 * Default summary formula names
 */
export type DefaultSummaryFormula =
  | 'Average'
  | 'Min'
  | 'Max'
  | 'Sum'
  | 'Range'
  | 'Median'
  | 'Stddev'
  | 'Earliest'
  | 'Latest'
  | 'Checked'
  | 'Unchecked'
  | 'Empty'
  | 'Filled'
  | 'Unique';

/**
 * Duration units for date arithmetic
 */
export type DurationUnit =
  | 'y' | 'year' | 'years'
  | 'M' | 'month' | 'months'
  | 'd' | 'day' | 'days'
  | 'w' | 'week' | 'weeks'
  | 'h' | 'hour' | 'hours'
  | 'm' | 'minute' | 'minutes'
  | 's' | 'second' | 'seconds';

/**
 * Property reference extracted from a filter expression.
 * Represents a property access like `file.name`, `note.status`, etc.
 */
export interface PropertyReference {
  /** The prefix: 'note', 'file', 'formula', 'this', or undefined for shorthand */
  prefix: PropertyPrefix | undefined;
  /** The property name (e.g., 'name', 'status', 'hasTag') */
  name: string;
  /** Full path as it appears in the expression */
  fullPath: string;
  /** Whether this is a method call (e.g., file.hasTag) */
  isMethod: boolean;
  /** Arguments if this is a method call */
  methodArgs?: string[];
}

/**
 * Function call extracted from a filter expression.
 * Represents function calls like `now()`, `date("2024-01-01")`, etc.
 */
export interface FunctionCall {
  /** Function name */
  name: string;
  /** Whether this is a global function (not a method) */
  isGlobal: boolean;
  /** Arguments as raw strings */
  arguments: string[];
  /** Object prefix if this is a method call (e.g., 'file' in file.hasTag) */
  objectPrefix?: string;
}

/**
 * Comparison operation extracted from a filter expression.
 * Represents comparisons like `status == "done"`, `priority > 3`
 */
export interface ComparisonOperation {
  /** The operator used */
  operator: ComparisonOperator;
  /** Left side of the comparison */
  left: PropertyReference | LiteralValue | FunctionCall;
  /** Right side of the comparison */
  right: PropertyReference | LiteralValue | FunctionCall;
}

/**
 * Literal value extracted from a filter expression.
 */
export interface LiteralValue {
  /** The literal type */
  type: 'string' | 'number' | 'boolean' | 'null' | 'regexp' | 'duration';
  /** The raw value as it appears in the expression */
  raw: string;
  /** The parsed value */
  value: string | number | boolean | null | RegExp;
}

/**
 * Expression type for filter expressions.
 */
export type ExpressionType =
  | 'comparison'
  | 'boolean'
  | 'arithmetic'
  | 'function_call'
  | 'property_access'
  | 'literal'
  | 'conditional'
  | 'unary'
  | 'complex';

/**
 * Parsed filter expression object containing the raw expression
 * and all extracted components for easy programmatic access.
 */
export interface FilterExpObject {
  /** The raw filter expression string */
  raw: string;

  /** The type of expression */
  expressionType: ExpressionType;

  /** The parsed AST (Abstract Syntax Tree) */
  ast?: ASTExpression;

  /** All property references found in the expression */
  properties: PropertyReference[];

  /** All function calls found in the expression */
  functionCalls: FunctionCall[];

  /** All comparison operations found in the expression */
  comparisons: ComparisonOperation[];

  /** All literal values found in the expression */
  literals: LiteralValue[];

  /** Whether the expression contains boolean operators (&&, ||, !) */
  hasBooleanOperators: boolean;

  /** Whether the expression contains date arithmetic (e.g., now() - "7d") */
  hasDateArithmetic: boolean;

  /** Whether the expression uses the 'this' keyword */
  usesThisReference: boolean;

  /** File methods used (e.g., hasTag, hasLink, inFolder) */
  fileMethods: string[];

  /** Note properties referenced (without prefix) */
  noteProperties: string[];

  /** File properties referenced */
  fileProperties: string[];

  /** Formula properties referenced */
  formulaProperties: string[];

  /** Tags referenced in file.hasTag() calls */
  referencedTags: string[];

  /** Folders referenced in file.inFolder() calls */
  referencedFolders: string[];

  /** Whether the expression is valid (can be parsed) */
  isValid: boolean;

  /** Parse errors if any */
  errors?: string[];
}

/**
 * A filter expression can be either a raw string or a parsed object.
 * When a string is used, it should be parsed into a FilterExpObject.
 */
export type FilterExpression = string | FilterExpObject;

/**
 * Recursive filter object that can contain AND, OR, or NOT conditions.
 * Each condition can be either a filter expression string, a parsed FilterExpObject,
 * or another filter object.
 */
export interface FilterObject {
  /** All conditions must be true */
  and?: (FilterExpression | FilterObject)[];
  /** Any condition can be true */
  or?: (FilterExpression | FilterObject)[];
  /** Exclude matching items */
  not?: (FilterExpression | FilterObject)[];
}

/**
 * Filter configuration - can be a single expression, a parsed object, or a complex filter object
 */
export type Filter = FilterExpression | FilterObject;

// =============================================================================
// PROPERTY SYSTEM
// =============================================================================

/**
 * Property prefix types for referencing different kinds of properties
 */
export type PropertyPrefix = 'note' | 'file' | 'formula' | 'this';

/**
 * Built-in file properties available in all files
 */
export type FileProperty =
  | 'file.name'
  | 'file.basename'
  | 'file.path'
  | 'file.folder'
  | 'file.ext'
  | 'file.size'
  | 'file.ctime'
  | 'file.mtime'
  | 'file.tags'
  | 'file.links'
  | 'file.backlinks'
  | 'file.embeds'
  | 'file.properties'
  | 'file.file';

/**
 * Date fields accessible on date objects
 */
export type DateField = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';

/**
 * Property configuration for display settings
 */
export interface PropertyConfig {
  /** Display name for the property in views */
  displayName?: string;
}

/**
 * Properties section configuration
 * Keys can be:
 * - note.property_name (or just property_name)
 * - file.property_name
 * - formula.formula_name
 * - this.property_name
 */
export type Properties = Record<string, PropertyConfig>;

// =============================================================================
// FORMULA SYSTEM
// =============================================================================

/**
 * Formula expression as a string.
 * Examples:
 * - 'price * quantity'
 * - 'if(done, "✅", "⏳")'
 * - 'file.ctime.format("YYYY-MM-DD")'
 * - '((now() - file.ctime) / 86400000).round(0)'
 */
export type FormulaExpression = string;

/**
 * Formulas section - defines computed properties
 */
export type Formulas = Record<string, FormulaExpression>;

// =============================================================================
// SUMMARY SYSTEM
// =============================================================================

/**
 * Custom summary formula expression.
 * The 'values' keyword is a list containing all values for that property.
 * Example: 'values.mean().round(3)'
 */
export type SummaryExpression = string;

/**
 * Summaries section - defines custom summary formulas
 */
export type Summaries = Record<string, SummaryExpression>;

/**
 * View summaries mapping - property name to summary formula name
 */
export type ViewSummaries = Record<string, DefaultSummaryFormula | string>;

// =============================================================================
// VIEW SYSTEM
// =============================================================================

/**
 * Group by configuration for views
 */
export interface GroupByConfig {
  /** Property to group by */
  property: string;
  /** Sort direction for groups */
  direction: SortDirection;
}

/**
 * Base view configuration (common to all view types)
 */
export interface BaseView {
  /** View type */
  type: ViewType;
  /** Display name for the view */
  name: string;
  /** Optional: limit number of results */
  limit?: number;
  /** Optional: group results by a property */
  groupBy?: GroupByConfig;
  /** Optional: view-specific filters */
  filters?: Filter;
  /** Properties to display in order */
  order?: string[];
  /** Optional: sort configuration (separate from display order) */
  sort?: SortConfig[];
  /** Optional: summary formulas mapped to properties */
  summaries?: ViewSummaries;
}

/**
 * Table view configuration
 */
export interface TableView extends BaseView {
  type: 'table';
  /** Optional: column size configuration (property name to width in pixels) */
  columnSize?: Record<string, number>;
}

/**
 * Cards view configuration
 */
export interface CardsView extends BaseView {
  type: 'cards';
  /** Optional: card size in pixels */
  cardSize?: number;
  /** Optional: image source property or preset */
  image?: ImageSource;
  /** Optional: image fit mode */
  imageFit?: ImageFit;
  /** Optional: image aspect ratio */
  imageAspectRatio?: number;
}

/**
 * List view configuration
 */
export interface ListView extends BaseView {
  type: 'list';
}

/**
 * Map view configuration (requires Maps community plugin)
 */
export interface MapView extends BaseView {
  type: 'map';
  /** Optional: latitude property name */
  latProperty?: string;
  /** Optional: longitude property name */
  lngProperty?: string;
  /** Optional: property for pin title */
  titleProperty?: string;
}

/**
 * Union type for all view configurations
 */
export type View = TableView | CardsView | ListView | MapView;

// =============================================================================
// BASE FILE SCHEMA
// =============================================================================

/**
 * Complete Obsidian Base file structure
 */
export interface ObsidianBase {
  /** Global filters applied to ALL views */
  filters?: Filter;
  /** Formula properties available across all views */
  formulas?: Formulas;
  /** Property display configurations */
  properties?: Properties;
  /** Custom summary formulas */
  summaries?: Summaries;
  /** View definitions */
  views: View[];
}

/**
 * Embedded base configuration (for use in Markdown code blocks)
 */
export interface EmbeddedBase extends ObsidianBase {
  /** Optional: embedding context */
  _embedded?: boolean;
}

// =============================================================================
// PARSER TYPES
// =============================================================================

/**
 * Token types for filter/formula expression parsing
 */
export enum TokenType {
  // Literals
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // Identifiers
  IDENTIFIER = 'IDENTIFIER',
  PROPERTY = 'PROPERTY',

  // Operators
  COMPARISON = 'COMPARISON',
  ARITHMETIC = 'ARITHMETIC',
  BOOLEAN_OP = 'BOOLEAN_OP',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  DOT = 'DOT',
  COMMA = 'COMMA',
  COLON = 'COLON',

  // Functions
  FUNCTION = 'FUNCTION',

  // Special
  DURATION = 'DURATION',
  REGEXP = 'REGEXP',
  EOF = 'EOF',
}

/**
 * Token representing a parsed element
 */
export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * Abstract Syntax Tree node types
 */
export enum ASTNodeType {
  // Expressions
  BINARY_EXPRESSION = 'BINARY_EXPRESSION',
  UNARY_EXPRESSION = 'UNARY_EXPRESSION',
  CALL_EXPRESSION = 'CALL_EXPRESSION',
  MEMBER_EXPRESSION = 'MEMBER_EXPRESSION',
  INDEX_EXPRESSION = 'INDEX_EXPRESSION',
  CONDITIONAL_EXPRESSION = 'CONDITIONAL_EXPRESSION',

  // Literals
  LITERAL = 'LITERAL',
  IDENTIFIER = 'IDENTIFIER',
  PROPERTY_ACCESS = 'PROPERTY_ACCESS',

  // Filter-specific
  FILTER_GROUP = 'FILTER_GROUP',
  FILTER_AND = 'FILTER_AND',
  FILTER_OR = 'FILTER_OR',
  FILTER_NOT = 'FILTER_NOT',
}

/**
 * Base AST node interface
 */
export interface ASTNode {
  type: ASTNodeType;
}

/**
 * Literal value node
 */
export interface LiteralNode extends ASTNode {
  type: ASTNodeType.LITERAL;
  value: string | number | boolean | null | RegExp;
  raw: string;
}

/**
 * Identifier node (variable/property name)
 */
export interface IdentifierNode extends ASTNode {
  type: ASTNodeType.IDENTIFIER;
  name: string;
  prefix?: PropertyPrefix;
}

/**
 * Binary expression node (operations with two operands)
 */
export interface BinaryExpressionNode extends ASTNode {
  type: ASTNodeType.BINARY_EXPRESSION;
  operator: ComparisonOperator | ArithmeticOperator | BooleanOperator | '.';
  left: ASTNode;
  right: ASTNode;
}

/**
 * Unary expression node (operations with one operand)
 */
export interface UnaryExpressionNode extends ASTNode {
  type: ASTNodeType.UNARY_EXPRESSION;
  operator: '!' | '-';
  argument: ASTNode;
}

/**
 * Function call expression node
 */
export interface CallExpressionNode extends ASTNode {
  type: ASTNodeType.CALL_EXPRESSION;
  callee: IdentifierNode | MemberExpressionNode;
  arguments: ASTNode[];
}

/**
 * Member expression node (property access with dot notation)
 */
export interface MemberExpressionNode extends ASTNode {
  type: ASTNodeType.MEMBER_EXPRESSION;
  object: ASTNode;
  property: IdentifierNode;
  computed: boolean;
}

/**
 * Index expression node (bracket notation access)
 */
export interface IndexExpressionNode extends ASTNode {
  type: ASTNodeType.INDEX_EXPRESSION;
  object: ASTNode;
  index: ASTNode;
}

/**
 * Conditional (ternary) expression node
 */
export interface ConditionalExpressionNode extends ASTNode {
  type: ASTNodeType.CONDITIONAL_EXPRESSION;
  test: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

/**
 * Filter group node (for nested filter objects)
 */
export interface FilterGroupNode extends ASTNode {
  type: ASTNodeType.FILTER_GROUP;
  operator: 'and' | 'or' | 'not';
  filters: ASTNode[];
}

/**
 * Union type for all AST nodes
 */
export type ASTExpression =
  | LiteralNode
  | IdentifierNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | CallExpressionNode
  | MemberExpressionNode
  | IndexExpressionNode
  | ConditionalExpressionNode
  | FilterGroupNode;

// =============================================================================
// PARSER RESULT TYPES
// =============================================================================

/**
 * Parse result containing AST or error information
 */
export interface ParseResult<T> {
  success: boolean;
  ast?: T;
  errors?: ParseError[];
}

/**
 * Parse error with position information
 */
export interface ParseError {
  message: string;
  position: number;
  expected?: string;
  received?: string;
}

/**
 * Validation result for filter expressions
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error with context
 */
export interface ValidationError {
  message: string;
  path: string;
  suggestion?: string;
}

// =============================================================================
// RUNTIME VALUE TYPES
// =============================================================================

/**
 * Value types supported by the formula/filter runtime
 */
export enum RuntimeValueType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  DURATION = 'DURATION',
  LIST = 'LIST',
  OBJECT = 'OBJECT',
  FILE = 'FILE',
  LINK = 'LINK',
  NULL = 'NULL',
  UNDEFINED = 'UNDEFINED',
}

/**
 * Runtime value wrapper
 */
export interface RuntimeValue {
  type: RuntimeValueType;
  value: unknown;
}

/**
 * Execution context for formula/filter evaluation
 */
export interface ExecutionContext {
  /** Current file being evaluated */
  file?: FileContext;
  /** Note properties from frontmatter */
  note?: Record<string, unknown>;
  /** Formula properties */
  formula?: Record<string, RuntimeValue>;
  /** The 'this' reference */
  this?: FileContext;
  /** Available functions */
  functions?: Record<string, Function>;
}

/**
 * File context for evaluation
 */
export interface FileContext {
  name: string;
  basename: string;
  path: string;
  folder: string;
  ext: string;
  size: number;
  ctime: Date;
  mtime: Date;
  tags: string[];
  links: string[];
  backlinks: string[];
  embeds: string[];
  properties: Record<string, unknown>;
}

// =============================================================================
// SERIALIZATION TYPES
// =============================================================================

/**
 * Options for serializing a base to YAML
 */
export interface SerializeOptions {
  /** Indentation level (default: 2) */
  indent?: number;
  /** Quote style for strings */
  quoteStyle?: 'single' | 'double' | 'auto';
  /** Include comments */
  includeComments?: boolean;
}

/**
 * Options for parsing a base from YAML
 */
export interface ParseOptions {
  /** Strict mode - fail on unknown properties */
  strict?: boolean;
  /** Validate formulas */
  validateFormulas?: boolean;
  /** Validate filters */
  validateFilters?: boolean;
}
