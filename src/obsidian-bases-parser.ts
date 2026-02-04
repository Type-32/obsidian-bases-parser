/**
 * Obsidian Bases Filter & Formula Parser
 * Based on: https://help.obsidian.md/bases
 *
 * This module provides a lexer, parser, and evaluator for Obsidian Bases
 * filter expressions and formulas with support for all special syntax.
 */

import {
  Token,
  TokenType,
  ASTNode,
  ASTNodeType,
  ASTExpression,
  LiteralNode,
  IdentifierNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  CallExpressionNode,
  MemberExpressionNode,
  IndexExpressionNode,
  ConditionalExpressionNode,
  FilterGroupNode,
  ParseResult,
  ParseError,
  ValidationResult,
  ValidationError,
  Filter,
  FilterObject,
  FilterExpObject,
  PropertyReference,
  FunctionCall,
  ComparisonOperation,
  LiteralValue,
  ExpressionType,
  RuntimeValue,
  RuntimeValueType,
  ExecutionContext,
  ComparisonOperator,
  ArithmeticOperator,
  BooleanOperator,
  PropertyPrefix,
} from './obsidian-bases-schema';

// =============================================================================
// LEXER - Tokenizes filter/formula expressions
// =============================================================================

/**
 * Regular expressions for tokenizing
 */
const TOKEN_PATTERNS: Array<{ type: TokenType; regex: RegExp }> = [
  // Whitespace (skipped)
  { type: TokenType.EOF, regex: /^\s+/ },

  // Strings (single and double quoted)
  { type: TokenType.STRING, regex: /^"(?:[^"\\]|\\.)*"/ },
  { type: TokenType.STRING, regex: /^'(?:[^'\\]|\\.)*'/ },

  // Duration strings (e.g., "1d", "2h", "3w")
  { type: TokenType.DURATION, regex: /^"\d+(?:y|year|years|M|month|months|d|day|days|w|week|weeks|h|hour|hours|m|minute|minutes|s|second|seconds)"/ },
  { type: TokenType.DURATION, regex: /^'\d+(?:y|year|years|M|month|months|d|day|days|w|week|weeks|h|hour|hours|m|minute|minutes|s|second|seconds)'/ },

  // Regular expressions (e.g., /pattern/flags)
  { type: TokenType.REGEXP, regex: /^\/(?:[^\/\\]|\\.)*\/[gimuy]*/ },

  // Numbers (integers and decimals)
  { type: TokenType.NUMBER, regex: /^\d+\.?\d*/ },

  // Comparison operators (must come before single char operators)
  { type: TokenType.COMPARISON, regex: /^(===|!==|==|!=|>=|<=|>|<)/ },

  // Boolean operators
  { type: TokenType.BOOLEAN_OP, regex: /^(\|\||&&|!)/ },

  // Arithmetic operators
  { type: TokenType.ARITHMETIC, regex: /^[\+\-\*\/\%]/ },

  // Delimiters
  { type: TokenType.LPAREN, regex: /^\(/ },
  { type: TokenType.RPAREN, regex: /^\)/ },
  { type: TokenType.LBRACKET, regex: /^\[/ },
  { type: TokenType.RBRACKET, regex: /^\]/ },
  { type: TokenType.DOT, regex: /^\./ },
  { type: TokenType.COMMA, regex: /^,/ },

  // Identifiers and keywords
  { type: TokenType.IDENTIFIER, regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },

  // Property access with brackets (e.g., ["key"])
  { type: TokenType.LBRACKET, regex: /^\[/ },
];

/**
 * Keywords that are treated specially
 */
const KEYWORDS: Record<string, TokenType> = {
  true: TokenType.BOOLEAN,
  false: TokenType.BOOLEAN,
  null: TokenType.NULL,
  if: TokenType.FUNCTION,
  and: TokenType.BOOLEAN_OP,
  or: TokenType.BOOLEAN_OP,
  not: TokenType.BOOLEAN_OP,
};

/**
 * Lexer for tokenizing Obsidian Bases expressions
 */
export class Lexer {
  private input: string;
  private position: number;

  constructor(input: string) {
    this.input = input;
    this.position = 0;
  }

  /**
   * Tokenize the entire input string
   */
  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.position < this.input.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    tokens.push({ type: TokenType.EOF, value: '', position: this.position });
    return tokens;
  }

  /**
   * Get the next token from the input
   */
  private nextToken(): Token | null {
    // Skip whitespace
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }

    if (this.position >= this.input.length) {
      return null;
    }

    const remaining = this.input.slice(this.position);

    for (const pattern of TOKEN_PATTERNS) {
      const match = remaining.match(pattern.regex);
      if (match) {
        const value = match[0];
        const startPos = this.position;
        this.position += value.length;

        // Skip whitespace tokens
        if (pattern.type === TokenType.EOF) {
          return this.nextToken();
        }

        // Check for keywords
        let type: TokenType = pattern.type;
        if (type === TokenType.IDENTIFIER && KEYWORDS[value]) {
          type = KEYWORDS[value];
        }

        return { type, value, position: startPos };
      }
    }

    // Unknown character - skip it
    this.position++;
    return this.nextToken();
  }
}

// =============================================================================
// PARSER - Builds AST from tokens
// =============================================================================

/**
 * Operator precedence (higher = binds tighter)
 */
const PRECEDENCE: Record<string, number> = {
  '.': 9,
  '[': 9,
  '(': 9,
  '!': 8,
  '*': 7,
  '/': 7,
  '%': 7,
  '+': 6,
  '-': 6,
  '>': 5,
  '<': 5,
  '>=': 5,
  '<=': 5,
  '==': 4,
  '!=': 4,
  '===': 4,
  '!==': 4,
  '&&': 3,
  '||': 2,
  '?': 1,
};

/**
 * Parser for Obsidian Bases expressions
 */
export class Parser {
  private tokens: Token[];
  private position: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.position = 0;
  }

  /**
   * Parse the expression into an AST
   */
  parse(): ParseResult<ASTExpression> {
    try {
      const ast = this.parseExpression();
      return { success: true, ast };
    } catch (error) {
      return {
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown parse error',
          position: this.currentToken()?.position || 0,
        }],
      };
    }
  }

  /**
   * Parse a complete expression (entry point)
   */
  private parseExpression(): ASTExpression {
    return this.parseConditional();
  }

  /**
   * Parse conditional (ternary) expression: condition ? consequent : alternate
   */
  private parseConditional(): ASTExpression {
    let test = this.parseOr();

    if (this.match(TokenType.ARITHMETIC) && this.currentToken()?.value === '?') {
      this.consume(); // consume '?'
      const consequent = this.parseExpression();

      if (!this.match(TokenType.COLON)) {
        throw new Error('Expected ":" in conditional expression');
      }
      this.consume(); // consume ':'

      const alternate = this.parseExpression();

      return {
        type: ASTNodeType.CONDITIONAL_EXPRESSION,
        test,
        consequent,
        alternate,
      } as ConditionalExpressionNode;
    }

    return test;
  }

  /**
   * Parse OR expression: left || right
   */
  private parseOr(): ASTExpression {
    let left = this.parseAnd();

    while (this.match(TokenType.BOOLEAN_OP) && this.currentToken()?.value === '||') {
      const operator = this.consume().value as BooleanOperator;
      const right = this.parseAnd();
      left = {
        type: ASTNodeType.BINARY_EXPRESSION,
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * Parse AND expression: left && right
   */
  private parseAnd(): ASTExpression {
    let left = this.parseEquality();

    while (this.match(TokenType.BOOLEAN_OP) && this.currentToken()?.value === '&&') {
      const operator = this.consume().value as BooleanOperator;
      const right = this.parseEquality();
      left = {
        type: ASTNodeType.BINARY_EXPRESSION,
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * Parse equality expression: left == right, left != right
   */
  private parseEquality(): ASTExpression {
    let left = this.parseComparison();

    while (this.match(TokenType.COMPARISON) &&
           (this.currentToken()?.value === '==' || this.currentToken()?.value === '!=')) {
      const operator = this.consume().value as ComparisonOperator;
      const right = this.parseComparison();
      left = {
        type: ASTNodeType.BINARY_EXPRESSION,
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * Parse comparison expression: >, <, >=, <=
   */
  private parseComparison(): ASTExpression {
    let left = this.parseAdditive();

    while (this.match(TokenType.COMPARISON) &&
           ['>', '<', '>=', '<='].includes(this.currentToken()?.value || '')) {
      const operator = this.consume().value as ComparisonOperator;
      const right = this.parseAdditive();
      left = {
        type: ASTNodeType.BINARY_EXPRESSION,
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * Parse additive expression: left + right, left - right
   */
  private parseAdditive(): ASTExpression {
    let left = this.parseMultiplicative();

    while (this.match(TokenType.ARITHMETIC) &&
           (this.currentToken()?.value === '+' || this.currentToken()?.value === '-')) {
      const operator = this.consume().value as ArithmeticOperator;
      const right = this.parseMultiplicative();
      left = {
        type: ASTNodeType.BINARY_EXPRESSION,
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * Parse multiplicative expression: *, /, %
   */
  private parseMultiplicative(): ASTExpression {
    let left = this.parseUnary();

    while (this.match(TokenType.ARITHMETIC) &&
           ['*', '/', '%'].includes(this.currentToken()?.value || '')) {
      const operator = this.consume().value as ArithmeticOperator;
      const right = this.parseUnary();
      left = {
        type: ASTNodeType.BINARY_EXPRESSION,
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * Parse unary expression: !expr, -expr
   */
  private parseUnary(): ASTExpression {
    if (this.match(TokenType.BOOLEAN_OP) && this.currentToken()?.value === '!') {
      this.consume();
      const argument = this.parseUnary();
      return {
        type: ASTNodeType.UNARY_EXPRESSION,
        operator: '!',
        argument,
      } as UnaryExpressionNode;
    }

    if (this.match(TokenType.ARITHMETIC) && this.currentToken()?.value === '-') {
      this.consume();
      const argument = this.parseUnary();
      return {
        type: ASTNodeType.UNARY_EXPRESSION,
        operator: '-',
        argument,
      } as UnaryExpressionNode;
    }

    return this.parseCall();
  }

  /**
   * Parse function call expression: func(arg1, arg2, ...)
   */
  private parseCall(): ASTExpression {
    let expr = this.parseMember();

    while (this.match(TokenType.LPAREN)) {
      this.consume(); // consume '('
      const args: ASTExpression[] = [];

      if (!this.match(TokenType.RPAREN)) {
        do {
          args.push(this.parseExpression());
        } while (this.match(TokenType.COMMA) && this.consume());
      }

      if (!this.match(TokenType.RPAREN)) {
        throw new Error('Expected ")" after function arguments');
      }
      this.consume(); // consume ')'

      expr = {
        type: ASTNodeType.CALL_EXPRESSION,
        callee: expr as IdentifierNode | MemberExpressionNode,
        arguments: args,
      } as CallExpressionNode;
    }

    return expr;
  }

  /**
   * Parse member expression: obj.prop or obj["prop"]
   */
  private parseMember(): ASTExpression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.DOT)) {
        this.consume(); // consume '.'
        const property = this.parseIdentifier();
        expr = {
          type: ASTNodeType.MEMBER_EXPRESSION,
          object: expr,
          property,
          computed: false,
        } as MemberExpressionNode;
      } else if (this.match(TokenType.LBRACKET)) {
        this.consume(); // consume '['
        const index = this.parseExpression();

        if (!this.match(TokenType.RBRACKET)) {
          throw new Error('Expected "]" after index expression');
        }
        this.consume(); // consume ']'

        expr = {
          type: ASTNodeType.INDEX_EXPRESSION,
          object: expr,
          index,
        } as IndexExpressionNode;
      } else {
        break;
      }
    }

    return expr;
  }

  /**
   * Parse primary expression (literals, identifiers, parenthesized expressions)
   */
  private parsePrimary(): ASTExpression {
    // String literal
    if (this.match(TokenType.STRING) || this.match(TokenType.DURATION)) {
      const token = this.consume();
      // Remove quotes from the value
      const raw = token.value;
      const value = raw.slice(1, -1);
      return {
        type: ASTNodeType.LITERAL,
        value,
        raw,
      } as LiteralNode;
    }

    // Number literal
    if (this.match(TokenType.NUMBER)) {
      const token = this.consume();
      const value = token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value, 10);
      return {
        type: ASTNodeType.LITERAL,
        value,
        raw: token.value,
      } as LiteralNode;
    }

    // Boolean literal
    if (this.match(TokenType.BOOLEAN)) {
      const token = this.consume();
      return {
        type: ASTNodeType.LITERAL,
        value: token.value === 'true',
        raw: token.value,
      } as LiteralNode;
    }

    // Null literal
    if (this.match(TokenType.NULL)) {
      const token = this.consume();
      return {
        type: ASTNodeType.LITERAL,
        value: null,
        raw: token.value,
      } as LiteralNode;
    }

    // Parenthesized expression
    if (this.match(TokenType.LPAREN)) {
      this.consume(); // consume '('
      const expr = this.parseExpression();

      if (!this.match(TokenType.RPAREN)) {
        throw new Error('Expected ")" after expression');
      }
      this.consume(); // consume ')'

      return expr;
    }

    // Identifier or property access
    if (this.match(TokenType.IDENTIFIER) || this.match(TokenType.FUNCTION)) {
      return this.parseIdentifier();
    }

    // RegExp literal
    if (this.match(TokenType.REGEXP)) {
      const token = this.consume();
      return {
        type: ASTNodeType.LITERAL,
        value: new RegExp(token.value.slice(1, -1)),
        raw: token.value,
      } as LiteralNode;
    }

    throw new Error(`Unexpected token: ${this.currentToken()?.value}`);
  }

  /**
   * Parse identifier with optional property prefix
   */
  private parseIdentifier(): IdentifierNode {
    const token = this.consume();
    const parts = token.value.split('.');

    let prefix: PropertyPrefix | undefined;
    let name: string;

    if (parts.length > 1 && ['note', 'file', 'formula', 'this'].includes(parts[0])) {
      prefix = parts[0] as PropertyPrefix;
      name = parts.slice(1).join('.');
    } else {
      // Default to note property if no prefix
      prefix = 'note';
      name = token.value;
    }

    return {
      type: ASTNodeType.IDENTIFIER,
      name,
      prefix,
    };
  }

  /**
   * Check if current token matches the given type
   */
  private match(type: TokenType): boolean {
    return this.currentToken()?.type === type;
  }

  /**
   * Get the current token without consuming it
   */
  private currentToken(): Token | undefined {
    return this.tokens[this.position];
  }

  /**
   * Consume and return the current token
   */
  private consume(): Token {
    return this.tokens[this.position++];
  }
}

// =============================================================================
// FILTER OBJECT PARSER - Parses YAML filter structures
// =============================================================================

/**
 * Parser for filter objects (the recursive and/or/not structure)
 */
export class FilterObjectParser {
  /**
   * Parse a filter (either a string expression or a filter object)
   */
  parseFilter(filter: Filter): ParseResult<ASTExpression | FilterGroupNode> {
    if (typeof filter === 'string') {
      // Single filter expression
      const lexer = new Lexer(filter);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      return parser.parse();
    } else {
      // Filter object with and/or/not
      return this.parseFilterObject(filter as FilterObject);
    }
  }

  /**
   * Parse a filter object recursively
   */
  private parseFilterObject(filterObj: FilterObject): ParseResult<FilterGroupNode> {
    const errors: ParseError[] = [];

    if (filterObj.and) {
      const filters: ASTExpression[] = [];
      for (const f of filterObj.and) {
        const result = this.parseFilter(f);
        if (result.success && result.ast) {
          filters.push(result.ast);
        } else if (result.errors) {
          errors.push(...result.errors);
        }
      }
      return {
        success: errors.length === 0,
        ast: {
          type: ASTNodeType.FILTER_GROUP,
          operator: 'and',
          filters,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    if (filterObj.or) {
      const filters: ASTExpression[] = [];
      for (const f of filterObj.or) {
        const result = this.parseFilter(f);
        if (result.success && result.ast) {
          filters.push(result.ast);
        } else if (result.errors) {
          errors.push(...result.errors);
        }
      }
      return {
        success: errors.length === 0,
        ast: {
          type: ASTNodeType.FILTER_GROUP,
          operator: 'or',
          filters,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    if (filterObj.not) {
      const filters: ASTExpression[] = [];
      for (const f of filterObj.not) {
        const result = this.parseFilter(f);
        if (result.success && result.ast) {
          filters.push(result.ast);
        } else if (result.errors) {
          errors.push(...result.errors);
        }
      }
      return {
        success: errors.length === 0,
        ast: {
          type: ASTNodeType.FILTER_GROUP,
          operator: 'not',
          filters,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    return {
      success: false,
      errors: [{ message: 'Empty filter object', position: 0 }],
    };
  }
}

// =============================================================================
// EVALUATOR - Executes parsed expressions
// =============================================================================

/**
 * Built-in functions available in Obsidian Bases formulas and filters
 */
export const BUILTIN_FUNCTIONS: Record<string, Function> = {
  // Global functions
  date: (value: string) => new Date(value),
  duration: (value: string) => parseDuration(value),
  now: () => new Date(),
  today: () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  },
  if: (condition: boolean, trueResult: unknown, falseResult?: unknown) =>
    condition ? trueResult : falseResult,
  min: (...args: number[]) => Math.min(...args),
  max: (...args: number[]) => Math.max(...args),
  number: (value: unknown) => Number(value),
  link: (path: string, display?: string) => ({ path, display, type: 'link' }),
  list: (element: unknown) => Array.isArray(element) ? element : [element],
  file: (path: string) => ({ path, type: 'file' }),
  image: (path: string) => ({ path, type: 'image' }),
  icon: (name: string) => ({ name, type: 'icon' }),
  html: (string: string) => ({ html: string, type: 'html' }),
  escapeHTML: (string: string) =>
    string
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),

  // String functions
  contains: (str: string, value: string) => str.includes(value),
  containsAll: (str: string, ...values: string[]) => values.every(v => str.includes(v)),
  containsAny: (str: string, ...values: string[]) => values.some(v => str.includes(v)),
  startsWith: (str: string, query: string) => str.startsWith(query),
  endsWith: (str: string, query: string) => str.endsWith(query),
  isEmpty: (value: unknown) =>
    value === null || value === undefined ||
    (typeof value === 'string' && value === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0),
  lower: (str: string) => str.toLowerCase(),
  title: (str: string) => str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
  trim: (str: string) => str.trim(),
  replace: (str: string, pattern: string | RegExp, replacement: string) =>
    str.replace(pattern, replacement),
  repeat: (str: string, count: number) => str.repeat(count),
  reverse: (str: string) => str.split('').reverse().join(''),
  slice: (str: string, start: number, end?: number) => str.slice(start, end),
  split: (str: string, separator: string, n?: number) => {
    const parts = str.split(separator);
    return n !== undefined ? parts.slice(0, n) : parts;
  },

  // Number functions
  abs: (n: number) => Math.abs(n),
  ceil: (n: number) => Math.ceil(n),
  floor: (n: number) => Math.floor(n),
  round: (n: number, digits = 0) => {
    const factor = Math.pow(10, digits);
    return Math.round(n * factor) / factor;
  },
  toFixed: (n: number, precision: number) => n.toFixed(precision),

  // List functions
  filter: (arr: unknown[], predicate: (value: unknown, index: number) => boolean) =>
    arr.filter(predicate),
  map: (arr: unknown[], mapper: (value: unknown, index: number) => unknown) =>
    arr.map(mapper),
  reduce: (arr: unknown[], reducer: (acc: unknown, value: unknown, index: number) => unknown, initial: unknown) =>
    arr.reduce(reducer, initial),
  flat: (arr: unknown[]) => (arr as unknown[][]).flat(),
  join: (arr: unknown[], separator: string) => arr.join(separator),
  sort: (arr: unknown[]) => [...arr].sort(),
  unique: (arr: unknown[]) => [...new Set(arr)],

  // Object functions
  keys: (obj: object) => Object.keys(obj),
  values: (obj: object) => Object.values(obj),

  // RegExp functions
  matches: (regexp: RegExp, string: string) => regexp.test(string),
};

/**
 * Parse a duration string into milliseconds
 */
function parseDuration(value: string): number {
  const match = value.match(/^(\d+)\s*(y|year|years|M|month|months|d|day|days|w|week|weeks|h|hour|hours|m|minute|minutes|s|second|seconds)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${value}`);
  }

  const num = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    y: 365 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
    M: 30 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    m: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    s: 1000,
    second: 1000,
    seconds: 1000,
  };

  return num * (multipliers[unit] || 0);
}

/**
 * Evaluator for executing parsed AST expressions
 */
export class Evaluator {
  private context: ExecutionContext;
  private functions: Record<string, Function>;

  constructor(context: ExecutionContext) {
    this.context = context;
    this.functions = { ...BUILTIN_FUNCTIONS, ...(context.functions || {}) };
  }

  /**
   * Evaluate an AST expression
   */
  evaluate(node: ASTNode): RuntimeValue {
    switch (node.type) {
      case ASTNodeType.LITERAL:
        return this.evaluateLiteral(node as LiteralNode);
      case ASTNodeType.IDENTIFIER:
        return this.evaluateIdentifier(node as IdentifierNode);
      case ASTNodeType.BINARY_EXPRESSION:
        return this.evaluateBinaryExpression(node as BinaryExpressionNode);
      case ASTNodeType.UNARY_EXPRESSION:
        return this.evaluateUnaryExpression(node as UnaryExpressionNode);
      case ASTNodeType.CALL_EXPRESSION:
        return this.evaluateCallExpression(node as CallExpressionNode);
      case ASTNodeType.MEMBER_EXPRESSION:
        return this.evaluateMemberExpression(node as MemberExpressionNode);
      case ASTNodeType.INDEX_EXPRESSION:
        return this.evaluateIndexExpression(node as IndexExpressionNode);
      case ASTNodeType.CONDITIONAL_EXPRESSION:
        return this.evaluateConditionalExpression(node as ConditionalExpressionNode);
      case ASTNodeType.FILTER_GROUP:
        return this.evaluateFilterGroup(node as FilterGroupNode);
      default:
        throw new Error(`Unknown node type: ${(node as ASTNode).type}`);
    }
  }

  /**
   * Evaluate a literal node
   */
  private evaluateLiteral(node: LiteralNode): RuntimeValue {
    const value = node.value;
    let type: RuntimeValueType;

    if (typeof value === 'string') type = RuntimeValueType.STRING;
    else if (typeof value === 'number') type = RuntimeValueType.NUMBER;
    else if (typeof value === 'boolean') type = RuntimeValueType.BOOLEAN;
    else if (value === null) type = RuntimeValueType.NULL;
    else if (typeof value === 'object' && value instanceof Date) type = RuntimeValueType.DATE;
    else if (typeof value === 'object' && value instanceof RegExp) type = RuntimeValueType.OBJECT;
    else type = RuntimeValueType.UNDEFINED;

    return { type, value };
  }

  /**
   * Evaluate an identifier node (property access)
   */
  private evaluateIdentifier(node: IdentifierNode): RuntimeValue {
    const { prefix, name } = node;

    // Check if this is a dynamic context variable (e.g., callback parameter)
    // Check this FIRST, even before prefix-based lookups, because dynamic variables
    // should take precedence over note/file properties
    if (name in this.context) {
      const contextValue = (this.context as Record<string, unknown>)[name];
      // Only use it if it's not one of the standard context properties
      if (!['file', 'note', 'formula', 'functions'].includes(name)) {
        return this.wrapValue(contextValue);
      }
    }

    switch (prefix) {
      case 'file':
        return this.getFileProperty(name);
      case 'note':
        // Try note properties first, then fall back to file
        // This allows properties like 'tags' to work even with 'note' prefix
        const noteValue = this.getNoteProperty(name);
        if (noteValue.type !== RuntimeValueType.UNDEFINED) {
          return noteValue;
        }
        return this.getFileProperty(name);
      case 'formula':
        return this.getFormulaProperty(name);
      case 'this':
        return this.getThisProperty(name);
      default:
        // Try note properties first, then fall back to file
        const defaultNoteValue = this.getNoteProperty(name);
        if (defaultNoteValue.type !== RuntimeValueType.UNDEFINED) {
          return defaultNoteValue;
        }
        return this.getFileProperty(name);
    }
  }

  /**
   * Get a file property value
   */
  private getFileProperty(name: string): RuntimeValue {
    if (!this.context.file) {
      return { type: RuntimeValueType.UNDEFINED, value: undefined };
    }

    const value = (this.context.file as unknown as Record<string, unknown>)[name];
    return this.wrapValue(value);
  }

  /**
   * Get a note property value
   */
  private getNoteProperty(name: string): RuntimeValue {
    if (!this.context.note) {
      return { type: RuntimeValueType.UNDEFINED, value: undefined };
    }

    // Only return the value if it actually exists in note properties
    // This allows falling through to file properties for properties like "tags"
    if (!(name in this.context.note)) {
      return { type: RuntimeValueType.UNDEFINED, value: undefined };
    }

    const value = this.context.note[name];
    return this.wrapValue(value);
  }

  /**
   * Get a formula property value
   */
  private getFormulaProperty(name: string): RuntimeValue {
    if (!this.context.formula) {
      return { type: RuntimeValueType.UNDEFINED, value: undefined };
    }

    const value = this.context.formula[name];
    return value || { type: RuntimeValueType.UNDEFINED, value: undefined };
  }

  /**
   * Get a 'this' property value
   */
  private getThisProperty(name: string): RuntimeValue {
    if (!this.context.this) {
      return { type: RuntimeValueType.UNDEFINED, value: undefined };
    }

    const value = (this.context.this as unknown as Record<string, unknown>)[name];
    return this.wrapValue(value);
  }

  /**
   * Wrap a JavaScript value in a RuntimeValue
   */
  private wrapValue(value: unknown): RuntimeValue {
    if (value === null) return { type: RuntimeValueType.NULL, value: null };
    if (value === undefined) return { type: RuntimeValueType.UNDEFINED, value: undefined };
    if (typeof value === 'string') return { type: RuntimeValueType.STRING, value };
    if (typeof value === 'number') return { type: RuntimeValueType.NUMBER, value };
    if (typeof value === 'boolean') return { type: RuntimeValueType.BOOLEAN, value };
    if (value instanceof Date) return { type: RuntimeValueType.DATE, value };
    if (Array.isArray(value)) return { type: RuntimeValueType.LIST, value };
    if (typeof value === 'object') return { type: RuntimeValueType.OBJECT, value };

    return { type: RuntimeValueType.UNDEFINED, value: undefined };
  }

  /**
   * Evaluate a binary expression
   */
  private evaluateBinaryExpression(node: BinaryExpressionNode): RuntimeValue {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    switch (node.operator) {
      // Arithmetic
      case '+':
        // Date + duration
        if (left.type === RuntimeValueType.DATE && right.type === RuntimeValueType.STRING) {
          const duration = parseDuration(right.value as string);
          return { type: RuntimeValueType.DATE, value: new Date((left.value as Date).getTime() + duration) };
        }
        // String concatenation
        if (left.type === RuntimeValueType.STRING || right.type === RuntimeValueType.STRING) {
          return { type: RuntimeValueType.STRING, value: String(left.value) + String(right.value) };
        }
        return { type: RuntimeValueType.NUMBER, value: (left.value as number) + (right.value as number) };

      case '-':
        // Date - duration
        if (left.type === RuntimeValueType.DATE && right.type === RuntimeValueType.STRING) {
          const duration = parseDuration(right.value as string);
          return { type: RuntimeValueType.DATE, value: new Date((left.value as Date).getTime() - duration) };
        }
        // Date - Date = milliseconds
        if (left.type === RuntimeValueType.DATE && right.type === RuntimeValueType.DATE) {
          return { type: RuntimeValueType.NUMBER, value: (left.value as Date).getTime() - (right.value as Date).getTime() };
        }
        return { type: RuntimeValueType.NUMBER, value: (left.value as number) - (right.value as number) };

      case '*':
        return { type: RuntimeValueType.NUMBER, value: (left.value as number) * (right.value as number) };

      case '/':
        return { type: RuntimeValueType.NUMBER, value: (left.value as number) / (right.value as number) };

      case '%':
        return { type: RuntimeValueType.NUMBER, value: (left.value as number) % (right.value as number) };

      // Comparison
      case '==':
        return { type: RuntimeValueType.BOOLEAN, value: left.value == right.value };

      case '!=':
        return { type: RuntimeValueType.BOOLEAN, value: left.value != right.value };

      case '>':
        return { type: RuntimeValueType.BOOLEAN, value: (left.value as number | Date) > (right.value as number | Date) };

      case '<':
        return { type: RuntimeValueType.BOOLEAN, value: (left.value as number | Date) < (right.value as number | Date) };

      case '>=':
        return { type: RuntimeValueType.BOOLEAN, value: (left.value as number | Date) >= (right.value as number | Date) };

      case '<=':
        return { type: RuntimeValueType.BOOLEAN, value: (left.value as number | Date) <= (right.value as number | Date) };

      // Boolean
      case '&&':
        return { type: RuntimeValueType.BOOLEAN, value: this.isTruthy(left) && this.isTruthy(right) };

      case '||':
        return { type: RuntimeValueType.BOOLEAN, value: this.isTruthy(left) || this.isTruthy(right) };

      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  /**
   * Evaluate a unary expression
   */
  private evaluateUnaryExpression(node: UnaryExpressionNode): RuntimeValue {
    const argument = this.evaluate(node.argument);

    switch (node.operator) {
      case '!':
        return { type: RuntimeValueType.BOOLEAN, value: !this.isTruthy(argument) };
      case '-':
        return { type: RuntimeValueType.NUMBER, value: -(argument.value as number) };
      default:
        throw new Error(`Unknown unary operator: ${node.operator}`);
    }
  }

  /**
   * Evaluate a function call expression
   */
  private evaluateCallExpression(node: CallExpressionNode): RuntimeValue {
    let func: Function | undefined;
    let thisArg: unknown = undefined;

    if (node.callee.type === ASTNodeType.IDENTIFIER) {
      // Global function call
      const name = (node.callee as IdentifierNode).name;
      func = this.functions[name];
      if (!func) {
        throw new Error(`Unknown function: ${name}`);
      }
    } else if (node.callee.type === ASTNodeType.MEMBER_EXPRESSION) {
      // Method call like file.hasTag("tag") or tags.filter(callback)
      const memberExpr = node.callee as MemberExpressionNode;
      const object = this.evaluate(memberExpr.object);
      const methodName = memberExpr.property.name;

      // Check if this is an array method with callback
      if (Array.isArray(object.value) && this.isArrayCallbackMethod(methodName)) {
        return this.evaluateArrayCallbackMethod(object.value, methodName, node.arguments);
      }

      // Try to get a built-in method for the value type
      func = this.getBuiltInMethod(object.value, methodName);
      thisArg = object.value;

      // If no built-in method found, handle special cases
      if (!func) {
        if (object.type === RuntimeValueType.FILE || memberExpr.object.type === ASTNodeType.IDENTIFIER) {
          const idNode = memberExpr.object.type === ASTNodeType.IDENTIFIER
            ? memberExpr.object as IdentifierNode
            : null;

          if (idNode?.prefix === 'file' || idNode?.name === 'file') {
            func = this.getFileMethod(methodName);
            thisArg = this.context.file;
          } else if (object.value && typeof object.value === 'object') {
            func = (object.value as Record<string, Function>)[methodName];
            thisArg = object.value;
          }
        } else if (object.value && typeof object.value === 'object') {
          func = (object.value as Record<string, Function>)[methodName];
          thisArg = object.value;
        }
      }

      if (!func) {
        throw new Error(`Unknown method: ${methodName} on ${typeof object.value}`);
      }
    } else {
      throw new Error('Invalid callee type for function call');
    }

    const args = node.arguments.map(arg => this.evaluate(arg).value);
    const result = func.apply(thisArg, args);

    return this.wrapValue(result);
  }

  /**
   * Check if a method is an array method that takes a callback
   */
  private isArrayCallbackMethod(methodName: string): boolean {
    return [
      'filter', 'map', 'find', 'findIndex', 'some', 'every',
      'forEach', 'reduce', 'reduceRight', 'flatMap'
    ].includes(methodName);
  }

  /**
   * Evaluate an array method call with a callback expression
   */
  private evaluateArrayCallbackMethod(
    array: unknown[],
    methodName: string,
    args: ASTNode[]
  ): RuntimeValue {
    if (args.length === 0) {
      throw new Error(`${methodName} requires at least one argument`);
    }

    const callbackExpr = args[0];
    
    // Extract the callback parameter name from the expression
    // For expressions like "value.containsAny('x')", we extract "value"
    const parameterName = this.extractCallbackParameterName(callbackExpr);

    // Create the callback function
    const callback = (element: unknown, index: number, arr: unknown[]) => {
      // Save the current context
      const savedContext = { ...this.context };
      
      // Create a new context with the callback parameter
      const callbackContext: ExecutionContext = {
        ...this.context,
        [parameterName]: element,
        index,
        array: arr
      };
      
      this.context = callbackContext;
      
      try {
        const result = this.evaluate(callbackExpr);
        return result.value;
      } finally {
        // Restore the original context
        this.context = savedContext;
      }
    };

    // Handle additional arguments (like initialValue for reduce)
    const additionalArgs = args.slice(1).map(arg => this.evaluate(arg).value);

    // Call the array method
    let result: unknown;
    switch (methodName) {
      case 'filter':
        result = array.filter(callback);
        break;
      case 'map':
        result = array.map(callback);
        break;
      case 'find':
        result = array.find(callback);
        break;
      case 'findIndex':
        result = array.findIndex(callback);
        break;
      case 'some':
        result = array.some(callback);
        break;
      case 'every':
        result = array.every(callback);
        break;
      case 'forEach':
        array.forEach(callback);
        result = undefined;
        break;
      case 'reduce':
        result = additionalArgs.length > 0
          ? array.reduce(callback as any, additionalArgs[0])
          : array.reduce(callback as any);
        break;
      case 'reduceRight':
        result = additionalArgs.length > 0
          ? array.reduceRight(callback as any, additionalArgs[0])
          : array.reduceRight(callback as any);
        break;
      case 'flatMap':
        result = array.flatMap(callback);
        break;
      default:
        throw new Error(`Unsupported array method: ${methodName}`);
    }

    return this.wrapValue(result);
  }

  /**
   * Extract the parameter name from a callback expression
   * For "value.containsAny('x')", returns "value"
   * For "item => item.prop", returns "item"
   */
  private extractCallbackParameterName(expr: ASTNode): string {
    // Default parameter name
    let paramName = 'value';

    // Try to extract from the expression
    if (expr.type === ASTNodeType.MEMBER_EXPRESSION) {
      const memberExpr = expr as MemberExpressionNode;
      if (memberExpr.object.type === ASTNodeType.IDENTIFIER) {
        const identifier = memberExpr.object as IdentifierNode;
        paramName = identifier.name;
      }
    } else if (expr.type === ASTNodeType.IDENTIFIER) {
      const identifier = expr as IdentifierNode;
      paramName = identifier.name;
    } else if (expr.type === ASTNodeType.CALL_EXPRESSION) {
      const callExpr = expr as CallExpressionNode;
      if (callExpr.callee.type === ASTNodeType.MEMBER_EXPRESSION) {
        const memberExpr = callExpr.callee as MemberExpressionNode;
        if (memberExpr.object.type === ASTNodeType.IDENTIFIER) {
          const identifier = memberExpr.object as IdentifierNode;
          paramName = identifier.name;
        }
      }
    }

    return paramName;
  }

  /**
   * Get a built-in method for primitive types (string, array, etc.)
   */
  private getBuiltInMethod(value: unknown, methodName: string): Function | undefined {
    // String methods
    if (typeof value === 'string') {
      const stringMethods: Record<string, Function> = {
        contains: function(this: string, substring: string) { return this.includes(substring); },
        containsAny: function(this: string, ...substrings: string[]) { 
          return substrings.some(sub => this.includes(sub));
        },
        containsAll: function(this: string, ...substrings: string[]) { 
          return substrings.every(sub => this.includes(sub));
        },
        startsWith: function(this: string, prefix: string) { return this.startsWith(prefix); },
        endsWith: function(this: string, suffix: string) { return this.endsWith(suffix); },
        toLowerCase: function(this: string) { return this.toLowerCase(); },
        toUpperCase: function(this: string) { return this.toUpperCase(); },
        trim: function(this: string) { return this.trim(); },
        match: function(this: string, pattern: string | RegExp) {
          const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
          return regex.test(this);
        },
        replace: function(this: string, search: string | RegExp, replacement: string) { 
          return this.replace(search, replacement);
        },
        split: function(this: string, separator: string) { return this.split(separator); },
        substring: function(this: string, start: number, end?: number) { return this.substring(start, end); },
        substr: function(this: string, start: number, length?: number) { return this.substr(start, length); },
        slice: function(this: string, start: number, end?: number) { return this.slice(start, end); },
        length: function(this: string) { return this.length; },
      };
      
      return stringMethods[methodName];
    }

    // Array methods (non-callback ones)
    if (Array.isArray(value)) {
      const arrayMethods: Record<string, Function> = {
        includes: function(this: unknown[], item: unknown) { return this.includes(item); },
        indexOf: function(this: unknown[], item: unknown) { return this.indexOf(item); },
        lastIndexOf: function(this: unknown[], item: unknown) { return this.lastIndexOf(item); },
        join: function(this: unknown[], separator?: string) { return this.join(separator); },
        slice: function(this: unknown[], start?: number, end?: number) { return this.slice(start, end); },
        concat: function(this: unknown[], ...items: unknown[]) { return this.concat(...items); },
        reverse: function(this: unknown[]) { return [...this].reverse(); }, // Non-mutating
        sort: function(this: unknown[]) { return [...this].sort(); }, // Non-mutating
        flat: function(this: unknown[], depth?: number) { return this.flat(depth); },
        length: function(this: unknown[]) { return this.length; },
        containsAny: function(this: unknown[], ...items: unknown[]) {
          return items.some(item => this.includes(item));
        },
        containsAll: function(this: unknown[], ...items: unknown[]) {
          return items.every(item => this.includes(item));
        },
      };
      
      return arrayMethods[methodName];
    }

    // Number methods
    if (typeof value === 'number') {
      const numberMethods: Record<string, Function> = {
        toFixed: function(this: number, digits?: number) { return this.toFixed(digits); },
        toPrecision: function(this: number, precision?: number) { return this.toPrecision(precision); },
        toExponential: function(this: number, fractionDigits?: number) { return this.toExponential(fractionDigits); },
        toString: function(this: number, radix?: number) { return this.toString(radix); },
      };
      
      return numberMethods[methodName];
    }

    // Date methods
    if (value instanceof Date) {
      const dateMethods: Record<string, Function> = {
        getTime: function(this: Date) { return this.getTime(); },
        getFullYear: function(this: Date) { return this.getFullYear(); },
        getMonth: function(this: Date) { return this.getMonth(); },
        getDate: function(this: Date) { return this.getDate(); },
        getDay: function(this: Date) { return this.getDay(); },
        getHours: function(this: Date) { return this.getHours(); },
        getMinutes: function(this: Date) { return this.getMinutes(); },
        getSeconds: function(this: Date) { return this.getSeconds(); },
        toISOString: function(this: Date) { return this.toISOString(); },
        toDateString: function(this: Date) { return this.toDateString(); },
        toTimeString: function(this: Date) { return this.toTimeString(); },
        toLocaleDateString: function(this: Date, ...args: unknown[]) { return this.toLocaleDateString(...args as any); },
        toLocaleTimeString: function(this: Date, ...args: unknown[]) { return this.toLocaleTimeString(...args as any); },
      };
      
      return dateMethods[methodName];
    }

    return undefined;
  }

  /**
   * Get a file method handler
   */
  private getFileMethod(name: string): Function {
    const fileMethods: Record<string, Function> = {
      hasTag: (thisArg: ExecutionContext['file'], ...tags: string[]) => {
        if (!thisArg) return false;
        return tags.some(tag => thisArg.tags.includes(tag));
      },
      hasLink: (thisArg: ExecutionContext['file'], otherFile: string) => {
        if (!thisArg) return false;
        return thisArg.links.some(link => link.includes(otherFile));
      },
      inFolder: (thisArg: ExecutionContext['file'], folder: string) => {
        if (!thisArg) return false;
        return thisArg.folder === folder || thisArg.folder.startsWith(folder + '/');
      },
      hasProperty: (thisArg: ExecutionContext['file'], name: string) => {
        if (!thisArg) return false;
        return name in thisArg.properties;
      },
      asLink: (thisArg: ExecutionContext['file'], display?: string) => {
        if (!thisArg) return null;
        return { path: thisArg.path, display, type: 'link' };
      },
    };

    return fileMethods[name] || (() => null);
  }

  /**
   * Evaluate a member expression (property access with dot)
   */
  private evaluateMemberExpression(node: MemberExpressionNode): RuntimeValue {
    const object = this.evaluate(node.object);
    const property = node.property.name;

    if (object.value && typeof object.value === 'object') {
      const value = (object.value as Record<string, unknown>)[property];
      return this.wrapValue(value);
    }

    return { type: RuntimeValueType.UNDEFINED, value: undefined };
  }

  /**
   * Evaluate an index expression (bracket access)
   */
  private evaluateIndexExpression(node: IndexExpressionNode): RuntimeValue {
    const object = this.evaluate(node.object);
    const index = this.evaluate(node.index);

    if (Array.isArray(object.value)) {
      const idx = index.value as number;
      return this.wrapValue(object.value[idx]);
    }

    if (object.value && typeof object.value === 'object') {
      const key = index.value as string;
      return this.wrapValue((object.value as Record<string, unknown>)[key]);
    }

    return { type: RuntimeValueType.UNDEFINED, value: undefined };
  }

  /**
   * Evaluate a conditional expression
   */
  private evaluateConditionalExpression(node: ConditionalExpressionNode): RuntimeValue {
    const test = this.evaluate(node.test);
    if (this.isTruthy(test)) {
      return this.evaluate(node.consequent);
    } else {
      return this.evaluate(node.alternate);
    }
  }

  /**
   * Evaluate a filter group (and/or/not)
   */
  private evaluateFilterGroup(node: FilterGroupNode): RuntimeValue {
    switch (node.operator) {
      case 'and':
        for (const filter of node.filters) {
          const result = this.evaluate(filter);
          if (!this.isTruthy(result)) {
            return { type: RuntimeValueType.BOOLEAN, value: false };
          }
        }
        return { type: RuntimeValueType.BOOLEAN, value: true };

      case 'or':
        for (const filter of node.filters) {
          const result = this.evaluate(filter);
          if (this.isTruthy(result)) {
            return { type: RuntimeValueType.BOOLEAN, value: true };
          }
        }
        return { type: RuntimeValueType.BOOLEAN, value: false };

      case 'not':
        for (const filter of node.filters) {
          const result = this.evaluate(filter);
          if (this.isTruthy(result)) {
            return { type: RuntimeValueType.BOOLEAN, value: false };
          }
        }
        return { type: RuntimeValueType.BOOLEAN, value: true };

      default:
        throw new Error(`Unknown filter operator: ${node.operator}`);
    }
  }

  /**
   * Check if a value is truthy
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
}

// =============================================================================
// VALIDATOR - Validates filter/formula expressions
// =============================================================================

/**
 * Validator for Obsidian Bases expressions
 */
export class Validator {
  private errors: ValidationError[] = [];

  /**
   * Validate a filter expression
   */
  validateFilter(filter: Filter): ValidationResult {
    this.errors = [];

    if (typeof filter === 'string') {
      this.validateExpression(filter, 'filter');
    } else {
      this.validateFilterObject(filter as FilterObject, 'filter');
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
    };
  }

  /**
   * Validate a formula expression
   */
  validateFormula(formula: string): ValidationResult {
    this.errors = [];
    this.validateExpression(formula, 'formula');

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
    };
  }

  /**
   * Validate an expression string
   */
  private validateExpression(expr: string, path: string): void {
    try {
      const lexer = new Lexer(expr);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const result = parser.parse();

      if (!result.success && result.errors) {
        for (const error of result.errors) {
          this.errors.push({
            message: error.message,
            path: `${path}[${error.position}]`,
          });
        }
      }
    } catch (error) {
      this.errors.push({
        message: error instanceof Error ? error.message : 'Validation error',
        path,
      });
    }
  }

  /**
   * Validate a filter object recursively
   */
  private validateFilterObject(filterObj: FilterObject, path: string): void {
    if (filterObj.and) {
      for (let i = 0; i < filterObj.and.length; i++) {
        const filter = filterObj.and[i];
        if (typeof filter === 'string') {
          this.validateExpression(filter, `${path}.and[${i}]`);
        } else {
          this.validateFilterObject(filter as FilterObject, `${path}.and[${i}]`);
        }
      }
    }

    if (filterObj.or) {
      for (let i = 0; i < filterObj.or.length; i++) {
        const filter = filterObj.or[i];
        if (typeof filter === 'string') {
          this.validateExpression(filter, `${path}.or[${i}]`);
        } else {
          this.validateFilterObject(filter as FilterObject, `${path}.or[${i}]`);
        }
      }
    }

    if (filterObj.not) {
      for (let i = 0; i < filterObj.not.length; i++) {
        const filter = filterObj.not[i];
        if (typeof filter === 'string') {
          this.validateExpression(filter, `${path}.not[${i}]`);
        } else {
          this.validateFilterObject(filter as FilterObject, `${path}.not[${i}]`);
        }
      }
    }

    if (!filterObj.and && !filterObj.or && !filterObj.not) {
      this.errors.push({
        message: 'Filter object must contain and, or, or not',
        path,
      });
    }
  }
}

// =============================================================================
// FILTER EXPRESSION PARSER - Parses filter strings into FilterExpObject
// =============================================================================

/**
 * Parser for converting filter expression strings into FilterExpObject
 * with all extracted components for easy programmatic access.
 */
export class FilterExpressionParser {
  /**
   * Parse a filter expression string into a FilterExpObject
   */
  parse(expression: string): FilterExpObject {
    const lexer = new Lexer(expression);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const result = parser.parse();

    if (!result.success || !result.ast) {
      return {
        raw: expression,
        expressionType: 'complex',
        properties: [],
        functionCalls: [],
        comparisons: [],
        literals: [],
        hasBooleanOperators: false,
        hasDateArithmetic: false,
        usesThisReference: false,
        fileMethods: [],
        noteProperties: [],
        fileProperties: [],
        formulaProperties: [],
        referencedTags: [],
        referencedFolders: [],
        isValid: false,
        errors: result.errors?.map(e => e.message) || ['Parse error'],
      };
    }

    const ast = result.ast;
    const extractor = new FilterExpressionExtractor(expression);
    extractor.extractFromAST(ast);

    return {
      raw: expression,
      expressionType: extractor.getExpressionType(),
      ast,
      properties: extractor.properties,
      functionCalls: extractor.functionCalls,
      comparisons: extractor.comparisons,
      literals: extractor.literals,
      hasBooleanOperators: extractor.hasBooleanOperators,
      hasDateArithmetic: extractor.hasDateArithmetic,
      usesThisReference: extractor.usesThisReference,
      fileMethods: extractor.fileMethods,
      noteProperties: extractor.noteProperties,
      fileProperties: extractor.fileProperties,
      formulaProperties: extractor.formulaProperties,
      referencedTags: extractor.referencedTags,
      referencedFolders: extractor.referencedFolders,
      isValid: true,
    };
  }
}

/**
 * Extracts components from a parsed AST for FilterExpObject
 */
class FilterExpressionExtractor {
  properties: PropertyReference[] = [];
  functionCalls: FunctionCall[] = [];
  comparisons: ComparisonOperation[] = [];
  literals: LiteralValue[] = [];
  hasBooleanOperators = false;
  hasDateArithmetic = false;
  usesThisReference = false;
  fileMethods: string[] = [];
  noteProperties: string[] = [];
  fileProperties: string[] = [];
  formulaProperties: string[] = [];
  referencedTags: string[] = [];
  referencedFolders: string[] = [];

  private rawExpression: string;

  constructor(rawExpression: string) {
    this.rawExpression = rawExpression;
  }

  /**
   * Extract all components from the AST
   */
  extractFromAST(node: ASTNode): void {
    this.traverse(node);
  }

  /**
   * Get the expression type based on extracted components
   */
  getExpressionType(): ExpressionType {
    if (this.comparisons.length > 0 && !this.hasBooleanOperators && this.functionCalls.length === 0) {
      return 'comparison';
    }
    if (this.hasBooleanOperators) {
      return 'boolean';
    }
    if (this.hasDateArithmetic) {
      return 'arithmetic';
    }
    if (this.functionCalls.length > 0 && this.comparisons.length === 0) {
      return 'function_call';
    }
    if (this.properties.length > 0 && this.comparisons.length === 0 && this.functionCalls.length === 0) {
      return 'property_access';
    }
    if (this.literals.length > 0 && this.properties.length === 0 && this.functionCalls.length === 0) {
      return 'literal';
    }
    return 'complex';
  }

  /**
   * Recursively traverse the AST and extract components
   */
  private traverse(node: ASTNode): void {
    if (!node) return;

    switch (node.type) {
      case ASTNodeType.LITERAL:
        this.extractLiteral(node as LiteralNode);
        break;

      case ASTNodeType.IDENTIFIER:
        this.extractIdentifier(node as IdentifierNode);
        break;

      case ASTNodeType.BINARY_EXPRESSION:
        this.extractBinaryExpression(node as BinaryExpressionNode);
        break;

      case ASTNodeType.UNARY_EXPRESSION:
        this.extractUnaryExpression(node as UnaryExpressionNode);
        break;

      case ASTNodeType.CALL_EXPRESSION:
        this.extractCallExpression(node as CallExpressionNode);
        break;

      case ASTNodeType.MEMBER_EXPRESSION:
        this.extractMemberExpression(node as MemberExpressionNode);
        break;

      case ASTNodeType.INDEX_EXPRESSION:
        this.extractIndexExpression(node as IndexExpressionNode);
        break;

      case ASTNodeType.CONDITIONAL_EXPRESSION:
        this.extractConditionalExpression(node as ConditionalExpressionNode);
        break;

      case ASTNodeType.FILTER_GROUP:
        this.extractFilterGroup(node as FilterGroupNode);
        break;
    }
  }

  /**
   * Extract literal value
   */
  private extractLiteral(node: LiteralNode): void {
    let type: LiteralValue['type'];
    const raw = node.raw;

    if (typeof node.value === 'string') {
      // Check if it's a duration string
      if (/^"\d+(?:y|year|years|M|month|months|d|day|days|w|week|weeks|h|hour|hours|m|minute|minutes|s|second|seconds)"$/.test(raw) ||
          /^'\d+(?:y|year|years|M|month|months|d|day|days|w|week|weeks|h|hour|hours|m|minute|minutes|s|second|seconds)'$/.test(raw)) {
        type = 'duration';
      } else {
        type = 'string';
      }
    } else if (typeof node.value === 'number') {
      type = 'number';
    } else if (typeof node.value === 'boolean') {
      type = 'boolean';
    } else if (node.value === null) {
      type = 'null';
    } else if (typeof node.value === 'object' && node.value instanceof RegExp) {
      type = 'regexp';
    } else {
      type = 'string';
    }

    this.literals.push({
      type,
      raw,
      value: node.value,
    });
  }

  /**
   * Extract identifier (property reference)
   */
  private extractIdentifier(node: IdentifierNode): void {
    const { prefix, name } = node;

    // Track property by prefix
    if (prefix === 'file') {
      this.fileProperties.push(name);
    } else if (prefix === 'note') {
      this.noteProperties.push(name);
    } else if (prefix === 'formula') {
      this.formulaProperties.push(name);
    } else if (prefix === 'this') {
      this.usesThisReference = true;
    }

    const fullPath = prefix ? `${prefix}.${name}` : name;

    this.properties.push({
      prefix,
      name,
      fullPath,
      isMethod: false,
    });
  }

  /**
   * Extract binary expression (comparison, arithmetic, boolean)
   */
  private extractBinaryExpression(node: BinaryExpressionNode): void {
    const op = node.operator;

    // Track boolean operators
    if (op === '&&' || op === '||') {
      this.hasBooleanOperators = true;
    }

    // Track date arithmetic
    if ((op === '+' || op === '-') && this.isDateArithmetic(node)) {
      this.hasDateArithmetic = true;
    }

    // Extract comparison operations
    if (['==', '!=', '>', '<', '>=', '<='].includes(op)) {
      const left = this.extractOperand(node.left);
      const right = this.extractOperand(node.right);

      if (left && right) {
        this.comparisons.push({
          operator: op as ComparisonOperator,
          left,
          right,
        });
      }
    }

    // Traverse children
    this.traverse(node.left);
    this.traverse(node.right);
  }

  /**
   * Check if a binary expression is date arithmetic
   */
  private isDateArithmetic(node: BinaryExpressionNode): boolean {
    // Check if either side involves dates
    const hasDate = (n: ASTNode): boolean => {
      if (n.type === ASTNodeType.IDENTIFIER) {
        const id = n as IdentifierNode;
        return id.name === 'now' || id.name === 'today' || id.name === 'ctime' || id.name === 'mtime';
      }
      if (n.type === ASTNodeType.CALL_EXPRESSION) {
        const call = n as CallExpressionNode;
        if (call.callee.type === ASTNodeType.IDENTIFIER) {
          const name = (call.callee as IdentifierNode).name;
          return name === 'now' || name === 'today' || name === 'date';
        }
      }
      return false;
    };

    return hasDate(node.left) || hasDate(node.right);
  }

  /**
   * Extract operand for comparison
   */
  private extractOperand(node: ASTNode): PropertyReference | LiteralValue | FunctionCall | null {
    if (node.type === ASTNodeType.IDENTIFIER) {
      const id = node as IdentifierNode;
      return {
        prefix: id.prefix,
        name: id.name,
        fullPath: id.prefix ? `${id.prefix}.${id.name}` : id.name,
        isMethod: false,
      };
    }

    if (node.type === ASTNodeType.LITERAL) {
      const lit = node as LiteralNode;
      return {
        type: typeof lit.value === 'string' ? 'string' :
              typeof lit.value === 'number' ? 'number' :
              typeof lit.value === 'boolean' ? 'boolean' : 'null',
        raw: lit.raw,
        value: lit.value,
      };
    }

    if (node.type === ASTNodeType.CALL_EXPRESSION) {
      return this.extractFunctionCallForOperand(node as CallExpressionNode);
    }

    return null;
  }

  /**
   * Extract unary expression
   */
  private extractUnaryExpression(node: UnaryExpressionNode): void {
    if (node.operator === '!') {
      this.hasBooleanOperators = true;
    }
    this.traverse(node.argument);
  }

  /**
   * Extract function call expression
   */
  private extractCallExpression(node: CallExpressionNode): void {
    const funcCall = this.extractFunctionCallForOperand(node);
    if (funcCall) {
      this.functionCalls.push(funcCall);

      // Track file methods
      if (funcCall.objectPrefix === 'file' && funcCall.name) {
        this.fileMethods.push(funcCall.name);

        // Extract tags from file.hasTag() calls
        if (funcCall.name === 'hasTag' && funcCall.arguments.length > 0) {
          const tagArg = funcCall.arguments[0];
          if (typeof tagArg === 'string') {
            this.referencedTags.push(tagArg.replace(/^["']|["']$/g, ''));
          }
        }

        // Extract folders from file.inFolder() calls
        if (funcCall.name === 'inFolder' && funcCall.arguments.length > 0) {
          const folderArg = funcCall.arguments[0];
          if (typeof folderArg === 'string') {
            this.referencedFolders.push(folderArg.replace(/^["']|["']$/g, ''));
          }
        }
      }
    }

    // Traverse arguments
    for (const arg of node.arguments) {
      this.traverse(arg);
    }
  }

  /**
   * Extract function call for operand
   */
  private extractFunctionCallForOperand(node: CallExpressionNode): FunctionCall | null {
    let name = '';
    let objectPrefix: string | undefined;
    let isGlobal = true;

    if (node.callee.type === ASTNodeType.IDENTIFIER) {
      name = (node.callee as IdentifierNode).name;
    } else if (node.callee.type === ASTNodeType.MEMBER_EXPRESSION) {
      const memberExpr = node.callee as MemberExpressionNode;
      name = memberExpr.property.name;

      if (memberExpr.object.type === ASTNodeType.IDENTIFIER) {
        objectPrefix = (memberExpr.object as IdentifierNode).name;
        isGlobal = false;
      }
    }

    // Extract arguments
    const args: string[] = [];
    for (const arg of node.arguments) {
      if (arg.type === ASTNodeType.LITERAL) {
        args.push((arg as LiteralNode).raw);
      } else if (arg.type === ASTNodeType.IDENTIFIER) {
        args.push((arg as IdentifierNode).name);
      } else {
        args.push('[expression]');
      }
    }

    return {
      name,
      isGlobal,
      arguments: args,
      objectPrefix,
    };
  }

  /**
   * Extract member expression (property access with dot)
   */
  private extractMemberExpression(node: MemberExpressionNode): void {
    // This is typically handled by extractIdentifier when it's part of a member chain
    this.traverse(node.object);

    // Add the property
    const propName = node.property.name;
    let objectPrefix: PropertyPrefix | undefined;

    if (node.object.type === ASTNodeType.IDENTIFIER) {
      const objId = node.object as IdentifierNode;
      objectPrefix = objId.prefix || objId.name as PropertyPrefix;

      if (['file', 'note', 'formula', 'this'].includes(objId.name)) {
        objectPrefix = objId.name as PropertyPrefix;
      }
    }

    const fullPath = objectPrefix ? `${objectPrefix}.${propName}` : propName;

    this.properties.push({
      prefix: objectPrefix,
      name: propName,
      fullPath,
      isMethod: false,
    });

    // Track by prefix
    if (objectPrefix === 'file') {
      this.fileProperties.push(propName);
    } else if (objectPrefix === 'note') {
      this.noteProperties.push(propName);
    } else if (objectPrefix === 'formula') {
      this.formulaProperties.push(propName);
    } else if (objectPrefix === 'this') {
      this.usesThisReference = true;
    }
  }

  /**
   * Extract index expression (bracket access)
   */
  private extractIndexExpression(node: IndexExpressionNode): void {
    this.traverse(node.object);
    this.traverse(node.index);
  }

  /**
   * Extract conditional expression
   */
  private extractConditionalExpression(node: ConditionalExpressionNode): void {
    this.traverse(node.test);
    this.traverse(node.consequent);
    this.traverse(node.alternate);
  }

  /**
   * Extract filter group
   */
  private extractFilterGroup(node: FilterGroupNode): void {
    for (const filter of node.filters) {
      this.traverse(filter);
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Parse a filter expression into an AST
 */
export function parseFilter(filter: Filter): ParseResult<ASTExpression | FilterGroupNode> {
  const parser = new FilterObjectParser();
  return parser.parseFilter(filter);
}

/**
 * Parse a filter expression string into a FilterExpObject
 * with all extracted components for easy programmatic access.
 *
 * Example:
 * ```typescript
 * const parsed = parseFilterExpression('file.hasTag("book") && status == "reading"');
 *
 * if (parsed.fileMethods.includes('hasTag')) {
 *   console.log('Tags referenced:', parsed.referencedTags);
 * }
 *
 * if (parsed.noteProperties.includes('status')) {
 *   console.log('Uses status property');
 * }
 *
 * for (const comparison of parsed.comparisons) {
 *   console.log(`${comparison.left.name} ${comparison.operator} ${comparison.right}`);
 * }
 * ```
 */
export function parseFilterExpression(expression: string): FilterExpObject {
  const parser = new FilterExpressionParser();
  return parser.parse(expression);
}

/**
 * Parse a formula expression into an AST
 */
export function parseFormula(formula: string): ParseResult<ASTExpression> {
  const lexer = new Lexer(formula);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Evaluate a filter expression against a context
 */
export function evaluateFilter(
  filter: Filter,
  context: ExecutionContext
): RuntimeValue {
  const parseResult = parseFilter(filter);

  if (!parseResult.success || !parseResult.ast) {
    throw new Error(`Failed to parse filter: ${parseResult.errors?.[0]?.message}`);
  }

  const evaluator = new Evaluator(context);
  return evaluator.evaluate(parseResult.ast);
}

/**
 * Evaluate a formula expression against a context
 */
export function evaluateFormula(
  formula: string,
  context: ExecutionContext
): RuntimeValue {
  const parseResult = parseFormula(formula);

  if (!parseResult.success || !parseResult.ast) {
    throw new Error(`Failed to parse formula: ${parseResult.errors?.[0]?.message}`);
  }

  const evaluator = new Evaluator(context);
  return evaluator.evaluate(parseResult.ast);
}

/**
 * Validate a filter expression
 */
export function validateFilter(filter: Filter): ValidationResult {
  const validator = new Validator();
  return validator.validateFilter(filter);
}

/**
 * Validate a formula expression
 */
export function validateFormula(formula: string): ValidationResult {
  const validator = new Validator();
  return validator.validateFormula(formula);
}
