---
name: nx-angular-monorepo-setup
description: Use when setting up or auditing an NX monorepo with Angular frontend and NestJS backend — verifying module boundary configuration, Angular component patterns, CSS layout rules, and accessibility landmarks are correctly in place.
---

# NX Angular Monorepo Setup

## Overview

Covers the mandatory configuration for a maintainable Angular + NestJS NX monorepo. Follow every section as a checklist — skipping one undermines the rest.

---

## 1. NX Module Boundaries

### Project Tags

Every project in `project.json` must have a `type` tag:

| Tag | Can import |
|-----|-----------|
| `type:application` | Everything |
| `type:feature` | `feature`, `ui`, `data-access`, `util` |
| `type:ui` | `ui`, `util` |
| `type:data-access` | `data-access`, `util` |
| `type:util` | `util` only |

```json
// libs/shared/ui/project.json
{
  "tags": ["type:ui", "scope:shared"]
}
```

### ESLint Boundary Rules

In `eslint.config.mjs` (or `.eslintrc.json`), wire up `@nx/enforce-module-boundaries`:

```js
// eslint.config.mjs
{
  rules: {
    '@nx/enforce-module-boundaries': ['error', {
      depConstraints: [
        { sourceTag: 'type:application', onlyDependsOn: ['type:feature', 'type:ui', 'type:data-access', 'type:util'] },
        { sourceTag: 'type:feature',     onlyDependsOn: ['type:ui', 'type:data-access', 'type:util'] },
        { sourceTag: 'type:ui',          onlyDependsOn: ['type:ui', 'type:util'] },
        { sourceTag: 'type:data-access', onlyDependsOn: ['type:data-access', 'type:util'] },
        { sourceTag: 'type:util',        onlyDependsOn: ['type:util'] },
      ]
    }]
  }
}
```

### Path Aliases

`tsconfig.base.json` must define aliases for each library so imports stay clean:

```json
{
  "compilerOptions": {
    "paths": {
      "@myapp/shared/ui": ["libs/shared/ui/src/index.ts"],
      "@myapp/shared/util": ["libs/shared/util/src/index.ts"]
    }
  }
}
```

**Validate:** `nx run-many --target=lint` — any broken boundary fails here.

---

## 2. Angular Component Patterns

### Generate, Don't Hand-Write

```bash
ng generate component features/my-feature
# shorthand:
ng g c features/my-feature
```

Standalone is the default in Angular 19+. Never create component files manually.

### Smart vs Presentational Split

| Smart (container) | Presentational (dumb) |
|-------------------|-----------------------|
| Injects services | No service injection |
| Owns state | Signal inputs / outputs only |
| Passes data down | Emits events up |
| Lives in `feature` lib | Lives in `ui` lib |

```ts
import { Component, input, output } from '@angular/core';

// ✅ Presentational — signal-based I/O only
@Component({ ... })
export class UserCardComponent {
  user = input.required<User>();       // Signal<User>
  age  = input(0);                     // Signal<number>, optional with default

  selected = output<User>();

  handleClick() {
    this.selected.emit(this.user());   // read signal with ()
  }
}
```

**Data flows down via `input()` / `input.required()`. Events flow up via `output()`. Never the reverse.**

---

## 3. CSS Layout & Responsiveness

### Layout Rules

| Use case | Property |
|----------|----------|
| 1D layout (row or column) | `display: flex` |
| 2D layout (rows + columns) | `display: grid` |
| Spacing between items | `gap` on the container |
| Fluid sizing | `clamp(min, preferred, max)` |

```css
/* ✅ Spacing via gap, not individual margins */
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

/* ✅ Fluid font/element size */
.heading {
  font-size: clamp(1rem, 2.5vw, 2rem);
}
```

Never compute per-element margins to create spacing between siblings — use `gap`.

---

## 4. Accessibility

### Semantic Landmarks

Every page must use landmark elements — these are required for screen readers:

```html
<header>…</header>
<nav>…</nav>
<main id="main-content">…</main>
<aside>…</aside>
<footer>…</footer>
```

### Skip Link

Add a skip link as the **first focusable element** in `index.html` or the root component:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

```css
.skip-link {
  position: absolute;
  transform: translateY(-100%);
}
.skip-link:focus {
  transform: translateY(0);
}
```

---

## 5. NX Tooling

### Caching

NX hashes inputs and outputs automatically. Ensure each `project.json` target specifies correct `inputs` so unchanged code is skipped:

```json
{
  "targets": {
    "build": {
      "inputs": ["default", "^default"]
    }
  }
}
```

### Dependency Graph

```bash
nx graph
```

Run this to spot circular dependencies before they compound. Any cycle between libraries is an architecture violation.

### Versioning & Changelogs

```bash
nx release
```

Use `nx release` for version bumps and changelog generation. Never hand-edit versions in `package.json` inside the monorepo.

---

## Configuration Checklist

- [ ] Every lib/app has a `type:*` tag in `project.json`
- [ ] `depConstraints` configured in ESLint with all 5 tag types
- [ ] Path aliases defined in `tsconfig.base.json` for all libraries
- [ ] All components generated with `ng g c` (standalone is default)
- [ ] Smart components live in `feature` libs; presentational in `ui` libs
- [ ] Presentational components use `input()` / `input.required()` / `output()` — no `@Input`/`@Output` decorators
- [ ] No service injection in presentational components
- [ ] Spacing via `gap`, not individual margins
- [ ] `clamp()` used for responsive sizing
- [ ] Landmark elements present in every page (`header`, `main`, `footer`)
- [ ] Skip link is first focusable element on page
- [ ] `nx run-many --target=lint` passes with no boundary violations
- [ ] `nx graph` shows no circular dependencies
