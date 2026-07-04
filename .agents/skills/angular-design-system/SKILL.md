---
name: angular-design-system
description: Use when creating or auditing a design system for an Angular/SCSS application — before any token files, SCSS variables, or component styles are written. Also use when an existing system lacks token architecture, accessibility compliance, or consistent naming conventions.
---

# Angular SCSS Design System

## Overview

Guide the user through building a **production-ready design system** for Angular + SCSS using a structured conversation across 8 phases. Each phase has a gate. Do not advance until it is met. Generate SCSS output only after all gates pass.

**Non-negotiable rules:**
1. Every value lives in a token. No magic numbers in component SCSS.
2. Three-tier architecture is mandatory: **Primitives → Semantic → Contextual**.
3. Accessibility is architecture. Verify contrast before generating output.
4. Semantic HTML first. ARIA is a last resort.

**Conversation rule:** Ask one phase at a time. Do not present all phases upfront.

---

## The Three-Tier Architecture

```
Tier 1 — PRIMITIVES    Raw named values (color palette, scale, font stacks)
              ↓
Tier 2 — SEMANTIC      Purpose aliases (color-primary, font-heading, space-layout)
              ↓
Tier 3 — CONTEXTUAL    Component-scoped tokens (btn-bg, input-border-focus)
```

Why this matters:
- Changing primitives → only semantic layer updates
- Dark mode / theme switch → only semantic layer changes
- Component refactor → only contextual tokens change

**Minimize total token count.** Each token must justify its existence. More tokens = more maintenance surface.

---

## Phase 1 — Application Context

Ask these questions before any design decisions:

- "What type of application is this?" (SaaS dashboard, e-commerce, admin panel, marketing site, public portal?)
- "Who are the primary users — technical, consumer, enterprise?"
- "What is the Angular setup?" (Standalone components? Angular Material as a base? CDK only? From scratch?)
- "Is dark mode required from day one, or deferred?"
- "Does this need RTL (Arabic, Hebrew, Persian) support?"
- "Target accessibility level: WCAG AA (4.5:1 contrast) or AAA (7:1)?" — Default answer: target AAA.

**Gate:** All 6 answered. Document them before Phase 2.

---

## Phase 2 — Brand Identity

- "Describe the brand personality in 3 adjectives."
- "Do you have an existing primary brand color? Provide it as hex."
- "Do you have existing brand typography guidelines?"
- "What emotional response should the interface evoke?"

### Startup without an existing brand — competitor color research first

For startups with no established brand color, **research the market before proposing a palette.** Users carry color expectations from the tools they already use. Aligning with the category color code lowers cognitive load and makes the product feel instantly familiar; deliberately breaking it is a calculated risk, not a default.

**How to run competitor color research:**

1. List the 3–5 most visible competitors or category leaders in the same market.
2. For each, extract the dominant UI color (primary button, nav, key action) as hex.
3. Convert to HSL — identify the hue family the category uses.
4. Present the "category color code" to the user and ask: **align (familiarity) or differentiate (distinctiveness)?**

| Category Example     | Dominant Hue         | Notable players |
|----------------------|----------------------|-----------------|
| B2B SaaS / Productivity | Blue 210–240°    | Notion, Linear, Jira |
| Fintech / Banking    | Blue-Navy 220–250°   | Stripe, Monzo, Revolut |
| Health / Wellness    | Green-Teal 140–180°  | Headspace, Calm |
| E-commerce / Retail  | Warm Neutral + Accent | Shopify, Etsy |
| Developer Tools      | Dark + Violet 260–280° | Vercel, Railway |
| Education / Learning | Purple 270–290°      | Duolingo, Coursera |

**Decision guide:**
- **Align:** When trust and familiarity are the biggest conversion barriers (fintech, healthcare, B2B enterprise). Users recognize the category instantly.
- **Differentiate:** When the market is saturated with one color and standing out has a clear brand benefit. Do this with intention, not by accident.

### If no existing color — propose from personality

| Personality           | Hue Range        |
|-----------------------|------------------|
| Trustworthy / Corporate | Blue 210–250°  |
| Energetic / Bold      | Red-Orange 0–30° |
| Innovative / Modern   | Violet 260–290°  |
| Natural / Calm        | Green 120–160°   |
| Premium / Sophisticated | Indigo 240–260° |
| Friendly / Approachable | Teal 170–200°  |

Propose a primary HSL value based on personality **and competitor research**. Confirm with user before any further generation.

**Gate:** Primary brand color confirmed as hex or HSL.

---

## Phase 3 — Color System

### Step 1: Generate the primitive palette

For each confirmed brand color, generate an 11-step scale. Adjust saturation per step — do not just change lightness linearly.

| Step | Lightness | Role                           |
|------|-----------|--------------------------------|
| 50   | 97%       | Tinted backgrounds, hover surfaces |
| 100  | 93%       | Subtle highlights              |
| 200  | 85%       | Light borders                  |
| 300  | 72%       | Disabled, placeholder text     |
| 400  | 58%       | Icons, illustrations           |
| 500  | 48%       | **Brand anchor color**         |
| 600  | 38%       | Hover states                   |
| 700  | 30%       | Active / pressed               |
| 800  | 22%       | Dark variants                  |
| 900  | 14%       | Near-black accents             |
| 950  | 8%        | Dark mode surfaces             |

Generate scales for: `primary`, `neutral` (gray), `success` (green), `warning` (amber), `error` (red), `info` (blue).

### Step 2: Verify contrast immediately

Before defining semantic tokens:
- White text on `primary-500` background → must pass ≥ 4.5:1 (AA), target 7:1 (AAA)
- If contrast fails on 500 → use 600 or 700 as the semantic `--color-primary`
- `primary-500` text on white → verify same ratios

**Use a contrast formula or tool. Do not guess. Flag any pair that fails.**

### Step 3: Define semantic color tokens

```scss
// Semantic tier — :root custom properties
--color-primary:           // primary-500 (or 600 if needed for contrast)
--color-primary-hover:     // primary-600
--color-primary-active:    // primary-700
--color-primary-subtle:    // primary-50
--color-on-primary:        // white or black — whichever passes 7:1

--color-surface:           // neutral-50 (light) / neutral-950 (dark)
--color-surface-raised:    // white (light) / neutral-900 (dark)
--color-on-surface:        // neutral-900 (light) / neutral-50 (dark)
--color-on-surface-muted:  // neutral-500

--color-border:            // neutral-200 (light) / neutral-700 (dark)
--color-border-strong:     // neutral-400

--color-success:           // green-600
--color-on-success:        // white
--color-warning:           // amber-500
--color-on-warning:        // neutral-900
--color-error:             // red-600
--color-on-error:          // white
--color-info:              // blue-500
--color-on-info:           // white

--color-focus-ring:        // primary-500 — always visible, never overridden
```

### Dark mode

Override only semantic tokens in the dark mode block. Primitives never change.

```scss
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: var(--color-neutral-950);
    --color-surface-raised: var(--color-neutral-900);
    --color-on-surface: var(--color-neutral-50);
    --color-on-surface-muted: var(--color-neutral-400);
    --color-border: var(--color-neutral-700);
    --color-border-strong: var(--color-neutral-500);
  }
}
```

**Gate:** Full primitive palette generated. Contrast ratios verified and documented. Semantic tokens defined.

---

## Phase 4 — Typography

- "Do you have brand fonts, or should we select a pairing?"
- "Tone: editorial (serif display), technical (monospaced accents), modern (geometric sans), or classic (humanist)?"
- "Google Fonts, self-hosted only, or system fonts?"

### Modular type scale (ratio 1.25 — Major Third)

| Token              | Size     | Role                    |
|--------------------|----------|-------------------------|
| `--font-size-xs`   | 0.75rem  | Captions, legal         |
| `--font-size-sm`   | 0.875rem | Labels, helper text     |
| `--font-size-md`   | 1rem     | Body (base)             |
| `--font-size-lg`   | 1.125rem | Lead / intro text       |
| `--font-size-xl`   | 1.25rem  | Subheadings, card title |
| `--font-size-2xl`  | 1.5rem   | H3                      |
| `--font-size-3xl`  | 1.875rem | H2                      |
| `--font-size-4xl`  | 2.25rem  | H1                      |
| `--font-size-5xl`  | 3rem     | Display                 |
| `--font-size-6xl`  | 3.75rem  | Hero display            |

### Required typography tokens

```scss
--font-family-display:     // Heading / hero face
--font-family-body:        // Running text
--font-family-mono:        // Code, data tables

--font-weight-regular: 400
--font-weight-medium:  500
--font-weight-semibold: 600
--font-weight-bold:    700

--line-height-tight:   1.25    // Headings
--line-height-snug:    1.375   // Subheadings
--line-height-normal:  1.5     // Body
--line-height-relaxed: 1.625   // Long-form

--tracking-tight:  -0.025em   // Large display (≥ 3xl)
--tracking-normal:  0em       // Body
--tracking-wide:    0.025em   // UI labels
--tracking-wider:   0.05em    // Overlines, eyebrows
```

**Gate:** Display + body font pair confirmed. Type scale tokens written.

---

## Phase 5 — Spacing, Layout, and Motion

Full default values for all scales are in `scss-output-templates.md`. The tables below define the naming contracts.

### Token reference

| Scale         | Naming pattern              | Steps / values                                  |
|---------------|-----------------------------|-------------------------------------------------|
| Spacing       | `--space-{n}`               | `px`, `1`–`24` (4px base grid, doubles at larger sizes) |
| Breakpoints   | `--bp-{size}`               | `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl` 1536 |
| Border radius | `--radius-{size}`           | `sm` / `md` / `lg` / `xl` / `2xl` / `full`     |
| Elevation     | `--shadow-{size}`           | `sm` / `md` / `lg` / `xl` / `2xl`              |
| Duration      | `--duration-{speed}`        | `fast` 100ms / `normal` 200ms / `slow` 300ms   |
| Easing        | `--ease-{curve}`            | `out` / `in-out` / `spring`                     |

Use breakpoints in SCSS as: `@media (min-width: #{map.get($breakpoints, 'md')}) { ... }`

### Motion — non-negotiable accessibility wrapper

This block must live in `_accessibility.scss` and is always global:

```scss
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Phase 6 — Component Inventory

Ask: "Which of these component groups does your application need?"

| Category   | Components                                                              |
|------------|-------------------------------------------------------------------------|
| Navigation | App shell header, sidebar nav, breadcrumbs, tabs, pagination            |
| Actions    | Button (primary, secondary, ghost, danger, icon-only), link button      |
| Forms      | Text input, textarea, select, checkbox, radio, toggle, search           |
| Feedback   | Alert/banner, toast, skeleton, progress bar, spinner                    |
| Surfaces   | Card, modal/dialog, drawer, tooltip, popover                            |
| Data       | Table, list, badge, chip/tag, avatar                                    |
| Typography | Heading (h1–h6), body, caption, label, code block                       |

### Contextual token pattern (per confirmed component)

Define these token groups for every interactive component:

**Sizing:** `--[component]-height-{sm|md|lg}`, `--[component]-padding-x-{sm|md|lg}`

**Typography:** `--[component]-font-size`, `--[component]-font-weight`

**Appearance:** `--[component]-radius`, `--[component]-border-width`, `--[component]-transition`

**State variants** (one set per visual variant — primary, secondary, ghost, danger...):
```
--[component]-[variant]-bg
--[component]-[variant]-text
--[component]-[variant]-border
--[component]-[variant]-bg-hover
--[component]-[variant]-bg-active
--[component]-[variant]-bg-disabled
--[component]-[variant]-text-disabled
--[component]-[variant]-shadow-focus
```

### Mandatory states — every interactive component must define all 8

| State       | CSS Selector                   | Visual Signal                         |
|-------------|--------------------------------|---------------------------------------|
| Default     | base styles                    | Resting appearance                    |
| Hover       | `:hover`                       | Background shift, cursor pointer      |
| Focus       | `:focus-visible`               | 3px `--color-focus-ring` outline, 2px offset |
| Active      | `:active`                      | Scale or brightness decrease          |
| Disabled    | `[disabled]`, `[aria-disabled]`| Reduced opacity, not-allowed cursor   |
| Loading     | `.is-loading`, `aria-busy`     | Spinner overlay, pointer-events: none |
| Error       | `[aria-invalid="true"]`        | `--color-error` border                |
| Read-only   | `[readonly]`                   | Visually distinct, no interaction     |

**Focus style — copy this exactly:**
```scss
&:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

Never use `outline: none` without providing an equally visible alternative.

**Gate:** Component list confirmed. Contextual token groups defined for all.

---

## Phase 7 — Accessibility Audit

Verify before generating output. If any item fails, fix the token or template — do not proceed.

**Semantics (verify in Angular templates):**
- [ ] Skip link is the **first focusable element**: `<a href="#main-content" class="skip-link">Skip to main content</a>`
- [ ] Landmarks used on every page: `<header>`, `<nav>`, `<main id="main-content">`, `<footer>`
- [ ] Interactive elements use native HTML: `<button>`, `<a>`, `<input>` — never `<div>` with click
- [ ] Form fields have visible `<label>` — placeholder is not a label
- [ ] Decorative images: `alt=""` — informative images: descriptive `alt`
- [ ] ARIA attributes only where no native HTML equivalent exists

**Contrast (use contrast checker — never estimate visually):**
- [ ] Normal text (< 18pt): ≥ 4.5:1 (AA min), ≥ 7:1 (AAA target)
- [ ] Large text (≥ 18pt or 14pt bold): ≥ 3:1 (AA min), ≥ 4.5:1 (AAA target)
- [ ] UI components and icons: ≥ 3:1 against adjacent colors
- [ ] Focus ring: ≥ 3:1 against adjacent background

**Keyboard:**
- [ ] All interactive elements are Tab-reachable
- [ ] Tab order matches visual reading order
- [ ] No keyboard trap anywhere in the UI
- [ ] Escape closes modals and drawers

**Avoid:**
- Third-party accessibility overlays or widgets — they conflict with screen readers

**Gate:** All checklist items confirmed. Document any deferred items with justification.

---

## Phase 8 — Generate SCSS Token Files

Triggered only after all 7 gates are passed.

### Output file structure

```
src/styles/
├── tokens/
│   ├── _primitives.scss       ← SCSS maps: $color-primary, $color-neutral…
│   ├── _semantic.scss         ← :root { --color-primary: …; }
│   ├── _contextual.scss       ← :root { --btn-primary-bg: …; }
│   └── _index.scss            ← @forward barrel
├── base/
│   ├── _reset.scss
│   ├── _typography.scss
│   └── _accessibility.scss   ← skip-link, focus-visible, reduced-motion
├── layout/
│   └── _grid.scss
└── styles.scss                ← Angular global entry point
```

### `styles.scss` — Angular entry point

```scss
@use 'tokens/index';
@use 'base/reset';
@use 'base/accessibility';
@use 'base/typography';
@use 'layout/grid';
```

### `angular.json` — required wiring

```json
{
  "styles": ["src/styles/styles.scss"],
  "stylePreprocessorOptions": {
    "includePaths": ["src/styles"]
  }
}
```

### Component SCSS pattern

```scss
// my-button.component.scss
// @use only if you need SCSS functions/mixins; never import tokens directly
// CSS custom properties are globally available via styles.scss

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--btn-height-md);
  padding: 0 var(--btn-padding-x-md);
  font-size: var(--btn-font-size);
  font-weight: var(--btn-font-weight);
  border-radius: var(--btn-radius);
  transition: var(--btn-transition);
  cursor: pointer;
  border: 1px solid transparent;

  // Primary variant
  &--primary {
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);

    &:hover   { background: var(--btn-primary-bg-hover); }
    &:active  { background: var(--btn-primary-bg-active); }

    &:focus-visible {
      outline: 3px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    &:disabled,
    &[aria-disabled="true"] {
      background: var(--btn-primary-bg-disabled);
      color: var(--btn-primary-text-disabled);
      cursor: not-allowed;
      pointer-events: none;
    }
  }
}
```

Complete, annotated SCSS for all generated files (`_primitives`, `_semantic`, `_contextual`, `_accessibility`, `_reset`, Angular page baseline) is in `scss-output-templates.md`.

---

## Token Naming Convention

Pattern: `--[category]-[role]-[variant]-[state]`

| Tier       | Pattern                       | Example                         |
|------------|-------------------------------|---------------------------------|
| Primitive  | `--color-[name]-[step]`       | `--color-blue-500`              |
| Semantic   | `--[category]-[role]`         | `--color-primary`, `--font-size-lg` |
| Contextual | `--[component]-[variant]-[prop]-[state]` | `--btn-primary-bg-hover` |

**Rules:**
- Kebab-case only — no camelCase, no underscores
- State suffix always last: `-hover`, `-active`, `-focus`, `-disabled`, `-error`
- Variant before state: `--btn-primary-bg-hover` — not `--btn-hover-bg`
- No redundancy: `--color-primary-primary` is invalid
- Color steps are numeric (50–950), never descriptive (`light`, `dark`)

---

## Common Mistakes

| Mistake                               | Correct Approach                                                  |
|---------------------------------------|-------------------------------------------------------------------|
| Magic numbers in component SCSS       | Every value references a token                                    |
| Primitives directly in components     | Always go through semantic tier to enable theming                 |
| Skipping semantic tier                | Primitives → components breaks dark mode and brand updates        |
| One giant token file                  | Split into `_primitives`, `_semantic`, `_contextual`              |
| Color names in semantic tokens        | `--color-primary` not `--color-blue` — role beats name            |
| Placeholder used as form label        | Always use a visible `<label>` element                            |
| ARIA before native HTML               | Semantic HTML first — ARIA for cases with no native equivalent    |
| Accessibility overlays (widgets)      | Never — they conflict with screen readers and assistive tech      |
| `outline: none` on focus              | Use `:focus-visible` with visible ring — never remove focus state |
| Shadows hardcoded                     | Use `--shadow-*` tokens — they change with theme/dark mode        |
| No `prefers-reduced-motion` block     | Always wrap animations; block is global in `_accessibility.scss`  |

---

## Final Delivery Checklist

Run before handing off output to the development team:

- [ ] Phase 1–7 gates all passed and documented
- [ ] `_primitives.scss`: SCSS maps for all color scales (11 steps each)
- [ ] `_semantic.scss`: CSS custom properties on `:root` for all categories
- [ ] Dark mode override block present (if dark mode is in scope)
- [ ] `_contextual.scss`: Component tokens covering all confirmed components
- [ ] All 8 interactive states covered per component
- [ ] `:focus-visible` styles on every interactive element
- [ ] Skip link is first focusable element in root component
- [ ] Landmark elements in page template (`header`, `nav`, `main`, `footer`)
- [ ] All contrast ratios verified and pass (≥ 4.5:1 AA, target ≥ 7:1 AAA)
- [ ] `prefers-reduced-motion` block in `_accessibility.scss`
- [ ] `angular.json` wired with `styles.scss` entry and `includePaths`
- [ ] `_index.scss` barrel with `@forward` for all token partials
