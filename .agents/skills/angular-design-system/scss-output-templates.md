# SCSS Output Templates

Complete, copy-paste-ready templates for each token file. Populate values from the conversation phases.

---

## `_primitives.scss`

```scss
// ============================================================
// TIER 1 — PRIMITIVES
// Raw value maps. Never referenced in components directly.
// Use SCSS map.get() or generate CSS vars in _semantic.scss.
// ============================================================
@use 'sass:map';

// --- Color Primitive Maps ------------------------------------
// Replace HSL values with generated palette from Phase 3.

$color-primary: (
  50:  hsl(217, 100%, 97%),
  100: hsl(217, 95%, 93%),
  200: hsl(216, 89%, 85%),
  300: hsl(215, 83%, 73%),
  400: hsl(214, 80%, 61%),
  500: hsl(217, 91%, 60%),  // ← brand anchor
  600: hsl(221, 83%, 53%),
  700: hsl(224, 76%, 48%),
  800: hsl(226, 71%, 40%),
  900: hsl(224, 64%, 33%),
  950: hsl(226, 55%, 20%),
) !default;

$color-neutral: (
  50:  hsl(210, 20%, 98%),
  100: hsl(220, 14%, 96%),
  200: hsl(220, 13%, 91%),
  300: hsl(216, 12%, 84%),
  400: hsl(218, 11%, 65%),
  500: hsl(220, 9%,  46%),
  600: hsl(215, 14%, 34%),
  700: hsl(217, 19%, 27%),
  800: hsl(215, 28%, 17%),
  900: hsl(221, 39%, 11%),
  950: hsl(229, 84%,  5%),
) !default;

$color-success: (
  50:  hsl(138, 76%, 97%),
  100: hsl(141, 84%, 93%),
  200: hsl(141, 79%, 85%),
  300: hsl(142, 72%, 71%),
  400: hsl(142, 65%, 57%),
  500: hsl(142, 72%, 45%),
  600: hsl(142, 76%, 36%),  // ← --color-success default
  700: hsl(142, 72%, 29%),
  800: hsl(143, 64%, 24%),
  900: hsl(144, 61%, 20%),
  950: hsl(145, 80%, 10%),
) !default;

$color-warning: (
  50:  hsl(48, 100%, 96%),
  100: hsl(48, 96%,  89%),
  200: hsl(48, 97%,  77%),
  300: hsl(46, 97%,  64%),
  400: hsl(43, 96%,  56%),
  500: hsl(38, 92%,  50%),  // ← --color-warning default
  600: hsl(32, 95%,  44%),
  700: hsl(26, 90%,  37%),
  800: hsl(23, 83%,  31%),
  900: hsl(22, 78%,  26%),
  950: hsl(21, 92%,  14%),
) !default;

$color-error: (
  50:  hsl(0, 86%, 97%),
  100: hsl(0, 93%, 94%),
  200: hsl(0, 96%, 89%),
  300: hsl(0, 94%, 82%),
  400: hsl(0, 91%, 71%),
  500: hsl(0, 84%, 60%),
  600: hsl(0, 72%, 51%),  // ← --color-error default
  700: hsl(0, 74%, 42%),
  800: hsl(0, 70%, 35%),
  900: hsl(0, 63%, 31%),
  950: hsl(0, 75%, 15%),
) !default;

$color-info: (
  50:  hsl(204, 100%, 97%),
  100: hsl(204, 94%, 94%),
  200: hsl(201, 94%, 86%),
  300: hsl(199, 90%, 73%),
  400: hsl(198, 83%, 60%),
  500: hsl(199, 88%, 48%),  // ← --color-info default
  600: hsl(200, 98%, 39%),
  700: hsl(201, 96%, 32%),
  800: hsl(201, 88%, 27%),
  900: hsl(202, 80%, 24%),
  950: hsl(204, 80%, 16%),
) !default;

// --- Helper function ------------------------------------------
// Usage: color($color-primary, 500)
@function color($map, $step) {
  @return map.get($map, $step);
}

// --- Type Scale -----------------------------------------------
$font-sizes: (
  xs:   0.75rem,
  sm:   0.875rem,
  md:   1rem,
  lg:   1.125rem,
  xl:   1.25rem,
  2xl:  1.5rem,
  3xl:  1.875rem,
  4xl:  2.25rem,
  5xl:  3rem,
  6xl:  3.75rem,
) !default;

// --- Spacing Scale --------------------------------------------
$spacing: (
  px:  1px,
  1:   0.25rem,
  2:   0.5rem,
  3:   0.75rem,
  4:   1rem,
  5:   1.25rem,
  6:   1.5rem,
  8:   2rem,
  10:  2.5rem,
  12:  3rem,
  16:  4rem,
  20:  5rem,
  24:  6rem,
) !default;

// --- Breakpoints ----------------------------------------------
$breakpoints: (
  sm:  640px,
  md:  768px,
  lg:  1024px,
  xl:  1280px,
  2xl: 1536px,
) !default;
```

---

## `_semantic.scss`

```scss
// ============================================================
// TIER 2 — SEMANTIC TOKENS
// Purpose-driven CSS custom properties.
// Only this file changes between themes or brand updates.
// ============================================================
@use 'primitives' as p;

:root {
  // --- Color: Primary -----------------------------------------
  --color-primary:          #{p.color(p.$color-primary, 500)};
  --color-primary-hover:    #{p.color(p.$color-primary, 600)};
  --color-primary-active:   #{p.color(p.$color-primary, 700)};
  --color-primary-subtle:   #{p.color(p.$color-primary, 50)};
  --color-on-primary:       #ffffff; // verify 7:1 contrast

  // --- Color: Neutral / Surface -------------------------------
  --color-surface:          #{p.color(p.$color-neutral, 50)};
  --color-surface-raised:   #ffffff;
  --color-on-surface:       #{p.color(p.$color-neutral, 900)};
  --color-on-surface-muted: #{p.color(p.$color-neutral, 500)};

  // --- Color: Border ------------------------------------------
  --color-border:           #{p.color(p.$color-neutral, 200)};
  --color-border-strong:    #{p.color(p.$color-neutral, 400)};

  // --- Color: Semantic Status ---------------------------------
  --color-success:          #{p.color(p.$color-success, 600)};
  --color-on-success:       #ffffff;
  --color-warning:          #{p.color(p.$color-warning, 500)};
  --color-on-warning:       #{p.color(p.$color-neutral, 900)};
  --color-error:            #{p.color(p.$color-error, 600)};
  --color-on-error:         #ffffff;
  --color-info:             #{p.color(p.$color-info, 500)};
  --color-on-info:          #ffffff;

  // --- Color: Focus (never override) -------------------------
  --color-focus-ring:       #{p.color(p.$color-primary, 500)};

  // --- Typography: Font Families -----------------------------
  --font-family-display:  'Inter', system-ui, sans-serif; // ← replace with actual
  --font-family-body:     'Inter', system-ui, sans-serif;
  --font-family-mono:     'JetBrains Mono', 'Fira Code', monospace;

  // --- Typography: Sizes -------------------------------------
  --font-size-xs:   #{map.get(p.$font-sizes, xs)};
  --font-size-sm:   #{map.get(p.$font-sizes, sm)};
  --font-size-md:   #{map.get(p.$font-sizes, md)};
  --font-size-lg:   #{map.get(p.$font-sizes, lg)};
  --font-size-xl:   #{map.get(p.$font-sizes, xl)};
  --font-size-2xl:  #{map.get(p.$font-sizes, 2xl)};
  --font-size-3xl:  #{map.get(p.$font-sizes, 3xl)};
  --font-size-4xl:  #{map.get(p.$font-sizes, 4xl)};
  --font-size-5xl:  #{map.get(p.$font-sizes, 5xl)};
  --font-size-6xl:  #{map.get(p.$font-sizes, 6xl)};

  // --- Typography: Weights -----------------------------------
  --font-weight-regular:   400;
  --font-weight-medium:    500;
  --font-weight-semibold:  600;
  --font-weight-bold:      700;

  // --- Typography: Line Heights ------------------------------
  --line-height-tight:    1.25;
  --line-height-snug:     1.375;
  --line-height-normal:   1.5;
  --line-height-relaxed:  1.625;

  // --- Typography: Letter Spacing ----------------------------
  --tracking-tight:   -0.025em;
  --tracking-normal:   0em;
  --tracking-wide:     0.025em;
  --tracking-wider:    0.05em;

  // --- Spacing -----------------------------------------------
  --space-px:  1px;
  --space-1:   0.25rem;
  --space-2:   0.5rem;
  --space-3:   0.75rem;
  --space-4:   1rem;
  --space-5:   1.25rem;
  --space-6:   1.5rem;
  --space-8:   2rem;
  --space-10:  2.5rem;
  --space-12:  3rem;
  --space-16:  4rem;
  --space-20:  5rem;
  --space-24:  6rem;

  // --- Border Radius -----------------------------------------
  --radius-sm:    0.125rem;
  --radius-md:    0.375rem;
  --radius-lg:    0.5rem;
  --radius-xl:    0.75rem;
  --radius-2xl:   1rem;
  --radius-full:  9999px;

  // --- Elevation / Shadow ------------------------------------
  --shadow-sm:   0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md:   0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06);
  --shadow-lg:   0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05);
  --shadow-xl:   0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04);
  --shadow-2xl:  0 25px 50px -12px rgb(0 0 0 / 0.25);

  // --- Motion ------------------------------------------------
  --duration-fast:    100ms;
  --duration-normal:  200ms;
  --duration-slow:    300ms;
  --ease-out:         cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out:      cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);
}

// --- Dark Mode Override (semantic only) ----------------------
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface:          #{p.color(p.$color-neutral, 950)};
    --color-surface-raised:   #{p.color(p.$color-neutral, 900)};
    --color-on-surface:       #{p.color(p.$color-neutral, 50)};
    --color-on-surface-muted: #{p.color(p.$color-neutral, 400)};
    --color-border:           #{p.color(p.$color-neutral, 700)};
    --color-border-strong:    #{p.color(p.$color-neutral, 500)};
    --shadow-sm:   0 1px 2px 0 rgb(0 0 0 / 0.2);
    --shadow-md:   0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -1px rgb(0 0 0 / 0.2);
    --shadow-lg:   0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -2px rgb(0 0 0 / 0.2);
  }
}
```

---

## `_contextual.scss` — Component Tokens

```scss
// ============================================================
// TIER 3 — CONTEXTUAL TOKENS
// Component-scoped tokens. Reference semantic tokens only.
// Add one block per confirmed component from Phase 6.
// ============================================================

:root {
  // =========================================================
  // BUTTON
  // =========================================================

  // Sizing
  --btn-height-sm: var(--space-8);
  --btn-height-md: var(--space-10);
  --btn-height-lg: var(--space-12);
  --btn-padding-x-sm: var(--space-3);
  --btn-padding-x-md: var(--space-4);
  --btn-padding-x-lg: var(--space-6);
  --btn-gap: var(--space-2);

  // Typography
  --btn-font-size:   var(--font-size-sm);
  --btn-font-weight: var(--font-weight-semibold);
  --btn-tracking:    var(--tracking-wide);

  // Shape
  --btn-radius:      var(--radius-md);
  --btn-transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color     var(--duration-fast) var(--ease-out),
    box-shadow       var(--duration-fast) var(--ease-out),
    color            var(--duration-fast) var(--ease-out);

  // Primary variant
  --btn-primary-bg:              var(--color-primary);
  --btn-primary-text:            var(--color-on-primary);
  --btn-primary-border:          transparent;
  --btn-primary-bg-hover:        var(--color-primary-hover);
  --btn-primary-bg-active:       var(--color-primary-active);
  --btn-primary-bg-disabled:     var(--color-primary-subtle);
  --btn-primary-text-disabled:   var(--color-on-surface-muted);

  // Secondary variant
  --btn-secondary-bg:            transparent;
  --btn-secondary-text:          var(--color-primary);
  --btn-secondary-border:        var(--color-primary);
  --btn-secondary-bg-hover:      var(--color-primary-subtle);
  --btn-secondary-bg-active:     var(--color-primary-subtle);
  --btn-secondary-bg-disabled:   transparent;
  --btn-secondary-text-disabled: var(--color-on-surface-muted);
  --btn-secondary-border-disabled: var(--color-border);

  // Ghost variant
  --btn-ghost-bg:           transparent;
  --btn-ghost-text:         var(--color-on-surface);
  --btn-ghost-border:       transparent;
  --btn-ghost-bg-hover:     var(--color-border);
  --btn-ghost-bg-active:    var(--color-border-strong);

  // Danger variant
  --btn-danger-bg:          var(--color-error);
  --btn-danger-text:        var(--color-on-error);
  --btn-danger-border:      transparent;
  --btn-danger-bg-hover:    hsl(from var(--color-error) h s calc(l - 8));
  --btn-danger-bg-active:   hsl(from var(--color-error) h s calc(l - 14));

  // =========================================================
  // INPUT / TEXTAREA
  // =========================================================

  --input-height:           var(--space-10);
  --input-padding-x:        var(--space-3);
  --input-font-size:        var(--font-size-md);
  --input-radius:           var(--radius-md);
  --input-border-width:     1px;
  --input-transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow   var(--duration-fast) var(--ease-out);

  --input-bg:               var(--color-surface-raised);
  --input-text:             var(--color-on-surface);
  --input-placeholder:      var(--color-on-surface-muted);
  --input-border:           var(--color-border-strong);

  --input-border-hover:     var(--color-primary);
  --input-border-focus:     var(--color-primary);
  --input-shadow-focus:     0 0 0 3px hsl(from var(--color-focus-ring) h s l / 0.25);

  --input-border-error:     var(--color-error);
  --input-shadow-error:     0 0 0 3px hsl(from var(--color-error) h s l / 0.2);

  --input-bg-disabled:      var(--color-surface);
  --input-text-disabled:    var(--color-on-surface-muted);
  --input-border-disabled:  var(--color-border);

  // =========================================================
  // CARD
  // =========================================================

  --card-bg:         var(--color-surface-raised);
  --card-border:     var(--color-border);
  --card-radius:     var(--radius-lg);
  --card-shadow:     var(--shadow-sm);
  --card-padding:    var(--space-6);
  --card-gap:        var(--space-4);

  --card-shadow-hover: var(--shadow-md);
  --card-transition:   box-shadow var(--duration-normal) var(--ease-out);

  // =========================================================
  // BADGE / CHIP
  // =========================================================

  --badge-font-size:   var(--font-size-xs);
  --badge-font-weight: var(--font-weight-semibold);
  --badge-padding-x:   var(--space-2);
  --badge-padding-y:   var(--space-1);
  --badge-radius:      var(--radius-full);
  --badge-tracking:    var(--tracking-wide);

  // =========================================================
  // MODAL / DIALOG
  // =========================================================

  --modal-bg:           var(--color-surface-raised);
  --modal-radius:       var(--radius-xl);
  --modal-shadow:       var(--shadow-2xl);
  --modal-padding:      var(--space-6);
  --modal-max-width:    32rem;
  --modal-backdrop:     rgb(0 0 0 / 0.5);

  // =========================================================
  // ALERT / BANNER
  // =========================================================

  --alert-padding:  var(--space-4);
  --alert-radius:   var(--radius-md);
  --alert-gap:      var(--space-3);
  --alert-font-size: var(--font-size-sm);

  // =========================================================
  // TABLE
  // =========================================================

  --table-cell-padding-x: var(--space-4);
  --table-cell-padding-y: var(--space-3);
  --table-border:         var(--color-border);
  --table-header-bg:      var(--color-surface);
  --table-row-hover-bg:   var(--color-primary-subtle);
  --table-font-size:      var(--font-size-sm);
}
```

---

## `_accessibility.scss`

```scss
// ============================================================
// ACCESSIBILITY — Required global declarations
// ============================================================

// Skip link (first focusable element in index.html)
.skip-link {
  position: absolute;
  top: 0;
  left: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  border-radius: 0 0 var(--radius-md) 0;
  z-index: 9999;
  transform: translateY(-100%);
  transition: transform var(--duration-fast) var(--ease-out);

  &:focus {
    transform: translateY(0);
  }
}

// Global focus-visible baseline
:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

// Remove focus ring for mouse users — :focus-visible handles this automatically
// Do NOT add :focus { outline: none } — it removes keyboard access

// Reduced motion
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

// Screen reader only utility
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## `_index.scss` — Barrel

```scss
// Forward all token partials — import only this in styles.scss
@forward 'primitives';
@forward 'semantic';
@forward 'contextual';
```

---

## `_reset.scss`

```scss
// Minimal reset — preserves accessibility
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
}

html {
  font-size: 100%;
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
}

body {
  font-family: var(--font-family-body);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  color: var(--color-on-surface);
  background-color: var(--color-surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

input,
button,
textarea,
select {
  font: inherit;
}

p,
h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}

// Remove list styles only when list has role="list"
// (preserves semantic meaning for screen readers)
ul[role="list"],
ol[role="list"] {
  list-style: none;
  padding: 0;
}
```

---

## Angular Page Template (Accessible Baseline)

```html
<!-- app.component.html -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<header>
  <nav aria-label="Main navigation">
    <!-- nav items -->
  </nav>
</header>

<main id="main-content" tabindex="-1">
  <router-outlet />
</main>

<footer>
  <!-- footer content -->
</footer>
```

`tabindex="-1"` on `<main>` allows the skip link target to receive programmatic focus in all browsers.
