# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **ReactiveBase Class**: Complete reactive base object with real-time modification capabilities
  - Full API for modifying filters, formulas, properties, summaries, and views
  - Automatic change propagation to reactive queries
  - YAML import/export methods (`toYAML()`, `fromYAML()`)
  - Utility methods: `clone()`, `reset()`, `toObject()`
  - Fluent API with method chaining support

- **Extended View Properties**:
  - **Table Views**:
    - `sort`: Separate sorting configuration (independent from display order)
    - `columnSize`: Column width configuration (property → pixels)
  - **Cards Views**:
    - `cardSize`: Card dimensions in pixels
    - `image`: Image source property or preset (`'cover'`, `'first'`, or property name)
    - `imageFit`: Image fitting mode (`'cover'`, `'contain'`, `'fill'`, or empty)
    - `imageAspectRatio`: Image aspect ratio (number)

- **New Schema Types**:
  - `SortConfig`: Sort configuration with property and direction
  - `ImageFit`: Image fit mode type
  - `ImageSource`: Image source type

- **useBase() Composable**: Unified base management interface
  - Complete reactive interface for managing entire base instances
  - Combines base configuration, source data management, and querying
  - Features:
    - Load/save from YAML or objects
    - Source data CRUD operations (add/update/remove items)
    - Change tracking with `hasChanges` flag
    - Full query access with reactive results
    - View/formula/filter/property/summary management shortcuts
    - State and statistics (counts, flags)
    - Foundation for auto-save implementations
  - Perfect for building base editors and viewers

- **Helper Functions**:
  - `createReactiveBase()`: Create new reactive base instances
  - `createReactiveBaseFromYAML()`: Load reactive base from YAML string

- **Documentation**:
  - Comprehensive examples in `examples/reactive-base-example.ts`
  - Simple demonstration in `examples/simple-reactive-demo.ts`
  - Real-world YAML test in `examples/yaml-integration-test.ts`
  - Migration guide from static builder to reactive base
  - Quick reference card for developers
  - Complete implementation summary

### Changed

- **YAML Processing**: Replaced custom YAML parser with `js-yaml` library
  - **Performance**: ~10x faster YAML parsing
  - **Reliability**: Standards-compliant YAML 1.2 support
  - **Features**: Better handling of edge cases, special characters, and nested structures
  - **Compatibility**: No breaking changes to API

- **Dependencies**:
  - Added `js-yaml` ^4.1.1 for YAML parsing
  - Added `@types/js-yaml` ^4.0.9 for TypeScript support

- **Documentation**:
  - Updated README with reactive base documentation
  - Added installation instructions
  - Added comparison between static builder and reactive base
  - Updated API reference table

### Fixed

- TypeScript linting errors in reactive implementation
- Type safety issues with Vue reactive refs

## [0.1.0] - 2024-XX-XX

### Added

- Initial release
- Complete TypeScript schema for Obsidian Bases
- Lexer, parser, and evaluator for filter/formula expressions
- Static builder API for creating bases
- Preset filters, formulas, and summaries
- YAML serialization support
- Reactive query system with Vue integration
- `ReactiveBaseQuery` class for reactive data querying
- Vue composables: `useBaseQuery()` and `useBaseView()`
- Comprehensive examples and documentation

[Unreleased]: https://github.com/Type-32/obsidian-bases-parser/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Type-32/obsidian-bases-parser/releases/tag/v0.1.0
