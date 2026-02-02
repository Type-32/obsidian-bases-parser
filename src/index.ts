/**
 * Obsidian Bases TypeScript Schema and Parser
 *
 * A complete TypeScript implementation for Obsidian Bases (.base files)
 * including schema definitions, lexer, parser, and evaluator.
 *
 * Based on: https://help.obsidian.md/bases
 */

// =============================================================================
// SCHEMA EXPORTS
// =============================================================================

export {
  // Enums
  TokenType,
  ASTNodeType,
  RuntimeValueType,

  // Filter types
  type ComparisonOperator,
  type BooleanOperator,
  type ArithmeticOperator,
  type SortDirection,
  type SortConfig,
  type ViewType,
  type DefaultSummaryFormula,
  type DurationUnit,
  type FilterExpression,
  type FilterExpObject,
  type FilterObject,
  type Filter,
  type PropertyReference,
  type FunctionCall,
  type ComparisonOperation,
  type LiteralValue,
  type ExpressionType,
  type ImageFit,
  type ImageSource,

  // Property types
  type PropertyPrefix,
  type FileProperty,
  type DateField,
  type PropertyConfig,
  type Properties,

  // Formula types
  type FormulaExpression,
  type Formulas,

  // Summary types
  type SummaryExpression,
  type Summaries,
  type ViewSummaries,

  // View types
  type GroupByConfig,
  type BaseView,
  type TableView,
  type CardsView,
  type ListView,
  type MapView,
  type View,

  // Base types
  type ObsidianBase,
  type EmbeddedBase,

  // Reactive types
  type BaseSource,
  type ReactiveBaseQueryOptions,
  type ReactiveBaseQueryResult,
  type QueryState,

  // Parser types
  type Token,
  type ASTNode,
  type LiteralNode,
  type IdentifierNode,
  type BinaryExpressionNode,
  type UnaryExpressionNode,
  type CallExpressionNode,
  type MemberExpressionNode,
  type IndexExpressionNode,
  type ConditionalExpressionNode,
  type FilterGroupNode,
  type ASTExpression,
  type ParseResult,
  type ParseError,
  type ValidationResult,
  type ValidationError,

  // Runtime types
  type RuntimeValue,
  type ExecutionContext,
  type FileContext,

  // Serialization types
  type SerializeOptions,
  type ParseOptions,
} from './obsidian-bases-schema';

// =============================================================================
// PARSER EXPORTS
// =============================================================================

export {
  // Classes
  Lexer,
  Parser,
  Evaluator,
  FilterObjectParser,
  FilterExpressionParser,
  Validator,

  // Constants
  BUILTIN_FUNCTIONS,

  // Convenience functions
  parseFilter,
  parseFilterExpression,
  parseFormula,
  evaluateFilter,
  evaluateFormula,
  validateFilter,
  validateFormula,
} from './obsidian-bases-parser';

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export {
  // Builders
  BaseBuilder,
  FilterBuilder,

  // Presets
  PresetFilters,
  PresetFormulas,
  PresetSummaries,

  // Property utilities
  parsePropertyPath,
  buildPropertyPath,
  normalizePropertyPath,

  // Serialization
  serializeToYAML,

  // Convenience functions
  createBase,
  createFilter,
  and,
  or,
  not,
} from './obsidian-bases-utils';

// =============================================================================
// REACTIVE EXPORTS
// =============================================================================

export {
  // Main classes
  ReactiveBaseQuery,
  ReactiveBase,

  // Vue composables
  useBaseQuery,
  useBaseView,
  useBase,

  // Types
  type UseBaseOptions,
  type UseBaseReturn,

  // YAML reader
  readBase,

  // Convenience functions
  createBaseQuery,
  createBaseQueryFromYAML,
  createReactiveBase,
  createReactiveBaseFromYAML,
} from './obsidian-bases-reactive';

// =============================================================================
// EXAMPLE EXPORTS
// =============================================================================

export {
  // Example bases
  taskTrackerBase,
  readingListBase,
  projectNotesBase,
  dailyNotesBase,

  // Example filters and formulas
  complexFilter,
  builtFilter,
  advancedFormulas,
  completeBase,

  // All examples
  examples,
} from './obsidian-bases-example';
