# Extended View Properties

This document describes the extended view properties that have been added to support advanced Obsidian Bases features.

## Overview

The schema has been extended to support additional view configuration options that are used in real-world Obsidian Bases files. These properties allow for more granular control over view appearance and behavior.

## New Schema Types

### SortConfig

```typescript
interface SortConfig {
  /** Property to sort by */
  property: string;
  /** Sort direction */
  direction: 'ASC' | 'DESC';
}
```

Used for explicit sorting configuration separate from display order.

### ImageFit

```typescript
type ImageFit = 'cover' | 'contain' | 'fill' | '';
```

Defines how images should be fitted within their container in cards/gallery views.

### ImageSource

```typescript
type ImageSource = 'cover' | 'first' | string;
```

Defines the source of images for cards/gallery views:
- `'cover'`: Use the note's cover image
- `'first'`: Use the first image in the note
- `string`: Use a specific property name

## Table View Properties

### sort

**Type:** `SortConfig[]`  
**Optional:** Yes

Defines explicit sorting for the view, separate from the display order. This allows you to display columns in one order but sort by different properties.

```typescript
const tableView: TableView = {
  type: 'table',
  name: 'Tasks',
  order: ['file.name', 'status', 'due'], // Display order
  sort: [
    { property: 'file.name', direction: 'ASC' },
    { property: 'file.mtime', direction: 'DESC' },
  ], // Sort order (different from display!)
};
```

**Use cases:**
- Sort by modification time but display name first
- Multi-level sorting (primary, secondary, tertiary)
- Sort by hidden properties

### columnSize

**Type:** `Record<string, number>`  
**Optional:** Yes

Defines the width of each column in pixels. Keys are property names, values are pixel widths.

```typescript
const tableView: TableView = {
  type: 'table',
  name: 'Notes',
  columnSize: {
    'file.name': 361,
    'note.tags': 762,
    'status': 150,
  },
};
```

**Use cases:**
- Set wider columns for long text content
- Set narrow columns for icons or short values
- Customize layout for better readability

## Cards View Properties

### cardSize

**Type:** `number`  
**Optional:** Yes

Defines the size of cards in pixels. This typically represents the width of each card.

```typescript
const cardsView: CardsView = {
  type: 'cards',
  name: 'Projects',
  cardSize: 250, // 250px wide cards
};
```

**Common values:**
- `150-200`: Compact cards
- `200-300`: Standard cards
- `300+`: Large cards

### image

**Type:** `ImageSource` (`'cover'` | `'first'` | string)  
**Optional:** Yes

Defines which image to display on each card.

```typescript
const cardsView: CardsView = {
  type: 'cards',
  name: 'Gallery',
  image: 'cover', // Use cover image
  // OR
  image: 'first', // Use first image in note
  // OR
  image: 'thumbnail', // Use 'thumbnail' property
};
```

**Options:**
- `'cover'`: Use the note's designated cover image
- `'first'`: Use the first embedded image
- Property name: Use value from a specific property

### imageFit

**Type:** `ImageFit` (`'cover'` | `'contain'` | `'fill'` | `''`)  
**Optional:** Yes

Defines how the image should be fitted within the card.

```typescript
const cardsView: CardsView = {
  type: 'cards',
  name: 'Photos',
  imageFit: 'cover', // Fill area, may crop
  // OR
  imageFit: 'contain', // Fit entire image, may letterbox
  // OR
  imageFit: 'fill', // Stretch to fill
  // OR
  imageFit: '', // Default/auto behavior
};
```

**Options:**
- `'cover'`: Image fills the area, may be cropped
- `'contain'`: Entire image is visible, may have letterboxing
- `'fill'`: Image is stretched to fill the area
- `''`: Use default fitting behavior

### imageAspectRatio

**Type:** `number`  
**Optional:** Yes

Defines the aspect ratio of the image container (width/height).

```typescript
const cardsView: CardsView = {
  type: 'cards',
  name: 'Portraits',
  imageAspectRatio: 0.55, // Tall portrait (width = 0.55 × height)
  // OR
  imageAspectRatio: 1.0, // Square
  // OR
  imageAspectRatio: 1.77, // Wide landscape (16:9)
};
```

**Common ratios:**
- `0.55-0.75`: Portrait orientation
- `1.0`: Square
- `1.33`: 4:3 landscape
- `1.77`: 16:9 widescreen
- `2.35`: Cinematic

## Real-World Example

Here's a complete example from an actual Obsidian Bases file:

```yaml
filters:
  not:
    - file.folder == "Templates"
formulas:
  Untitled: ""
views:
  - type: table
    name: All Entries
    filters:
      and:
        - tags.filter(value.containsAny('kthalatir'))
    order:
      - file.name
      - file.mtime
      - file.ctime
      - tags
      - file.path
      - formula.Untitled
    sort:
      - property: file.name
        direction: ASC
      - property: file.mtime
        direction: DESC
    columnSize:
      file.name: 361
      note.tags: 762
  - type: cards
    name: Kthalatir Races
    filters:
      and:
        - tags.filter(value.containsAny("kthalatir/races"))
    order:
      - file.name
      - file.mtime
    cardSize: 210
    imageFit: ""
    imageAspectRatio: 0.55
    image: cover
  - type: cards
    name: Kthalatir Characters
    filters:
      and:
        - tags.filter(value.containsAny("kthalatir/characters"))
    order:
      - file.name
      - file.mtime
      - file.ctime
    cardSize: 250
    image: cover
    imageFit: ""
    imageAspectRatio: 1.4
```

## Using the API

### Creating Table Views with Extended Properties

```typescript
import { createReactiveBase } from './index';

const base = createReactiveBase();

base.addTableView('My Table', {
  order: ['file.name', 'status', 'priority'],
  sort: [
    { property: 'priority', direction: 'DESC' },
    { property: 'file.name', direction: 'ASC' },
  ],
  columnSize: {
    'file.name': 300,
    'status': 150,
    'priority': 100,
  },
});
```

### Creating Cards Views with Extended Properties

```typescript
base.addCardsView('Project Gallery', {
  order: ['file.name'],
  cardSize: 250,
  image: 'cover',
  imageFit: 'cover',
  imageAspectRatio: 1.4,
});
```

### Static Builder Support

The static `BaseBuilder` also supports all extended properties:

```typescript
import { createBase } from './index';

const base = createBase()
  .addTableView('Tasks', {
    order: ['file.name'],
    sort: [{ property: 'priority', direction: 'DESC' }],
    columnSize: { 'file.name': 300 },
  })
  .addCardsView('Cards', {
    cardSize: 200,
    image: 'cover',
    imageFit: 'contain',
    imageAspectRatio: 1.0,
  })
  .build();
```

## YAML Serialization

All extended properties are fully supported in YAML serialization and deserialization:

```typescript
// Parse YAML with extended properties
const base = readBase(yamlString);

// Modify and serialize back
const reactiveBase = createReactiveBase();
reactiveBase.fromYAML(yamlString);
reactiveBase.addTableView('New View', {
  sort: [{ property: 'date', direction: 'DESC' }],
});
const updatedYaml = reactiveBase.toYAML();
```

## Backward Compatibility

All extended properties are **optional**. Existing code continues to work without modification:

```typescript
// This still works - extended properties are optional
base.addTableView('Simple', {
  order: ['file.name'],
});

base.addCardsView('Basic Cards', {
  order: ['file.name'],
});
```

## Testing

The `examples/yaml-integration-test.ts` file includes comprehensive tests for:
- Parsing YAML with extended properties
- Recreating bases with extended properties via API
- Round-trip conversion (parse → modify → serialize → parse)
- Verification of property preservation

Run the tests:

```bash
bun run examples/yaml-integration-test.ts
```

## Summary

The extended properties provide:

✅ **Full feature parity** with Obsidian Bases  
✅ **Fine-grained control** over view appearance  
✅ **Backward compatible** - all properties optional  
✅ **Fully typed** - TypeScript support for all properties  
✅ **YAML support** - Parse and serialize extended properties  
✅ **API support** - Available in both static and reactive builders  

These additions make the parser suitable for real-world Obsidian Bases files with advanced configuration requirements.
