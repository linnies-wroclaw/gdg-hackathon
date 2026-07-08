---
name: designer-agent-styles
description: Rules and guidelines for the designer agent editing CSS/SCSS styles, design tokens, and layout components in the Angular project. Covers style isolation, token abstraction layers, and CSS encapsulation best practices.
---

# Designer Agent Styles & Isolation Guidelines

This skill provides mandatory architectural rules and guidelines for editing or generating UI styles, SCSS tokens, and component layouts within the Angular application.

---

## 1. Style Isolation & Encapsulation Rules

Angular uses **Emulated View Encapsulation** by default. This means component SCSS files are scoped strictly to the component's own HTML elements.

- **Child Component Styling**: A parent component's SCSS **MUST NOT** contain style declarations for selectors inside a child component (e.g., parent `chat-page.scss` styling elements inside `<app-chat-sidebar>` or `<app-chat-message>`). This fails because Angular scopes class names (e.g., `.chat__sidebar[_ngcontent-c1]`).
- **Host Component Styling**: To style a component's own root tag (the host element):
  - Do NOT wrap the template in an extra container.
  - Use the `host` property in the TypeScript component class to bind classes, roles, and ARIA attributes (e.g., `host: { 'class': 'chat__sidebar', 'role': 'complementary' }`).
  - Use `:host` selector in the component's SCSS file to style the host container itself.
  - Use `:host.className` to apply conditional alignments (e.g., `:host.chat__message--user` to set `align-self: flex-end`).
- **Global Component Styles**: Styles that are shared between multiple components or are used inside dynamic template outlets (like `.chat__bubble`, `.chat__message`, and `.chat__bubble--thinking`) **MUST** be placed in the global component layer (e.g., [src/styles/components/_chat.scss](solution-system/apps/frontend/src/styles/components/_chat.scss)) and imported in the global [styles.scss](solution-system/apps/frontend/src/styles.scss).

---

## 2. Three-Tier Token Abstraction Architecture

Every design value (colors, margins, typography, border-radius, shadows) must follow the three-tier token system. **Never hardcode hex values, sizes, or line heights directly in component styling.**

1. **Tier 1: Primitives** ([_primitives.scss](solution-system/apps/frontend/src/styles/tokens/_primitives.scss)):
   - Defines the raw color palette scales, spacing grid, and font stacks.
   - Example: `--color-blue-500: #3b82f6;`, `--space-4: 1rem;`
2. **Tier 2: Semantics** ([_semantic.scss](solution-system/apps/frontend/src/styles/tokens/_semantic.scss)):
   - Maps primitives to functional roles (e.g., primary, error, surface background, borders).
   - This layer enables theming and dark mode.
   - Example: `--color-primary: var(--color-blue-500);`, `--color-surface: var(--color-neutral-50);`
3. **Tier 3: Contextual / Component Tokens**:
   - Maps semantic tokens to specific component properties.
   - Example: `--btn-primary-bg: var(--color-primary);`

---

## 3. General Best Practices

- **Responsive Design**: Place media queries directly inside the selector rule they modify, or use the breakpoints map for consistency.
- **Motion Accessibility**: Ensure all transition animations are paused when `prefers-reduced-motion: reduce` is active.
- **Interactive States**: Always cover all 8 interactive states (Default, Hover, Focus-visible, Active, Disabled, Loading, Error, Read-only) for buttons, inputs, and form controls.

---

## 4. Design Verification & CI/CD Linting

To prevent any layout degradation and preserve style isolation, the project runs an automated **Design Token Linter** in the CI/CD pipeline.

### Rules Enforced by Linter

- **No Hardcoded Hex Colors**: Selectors cannot contain raw hex colors (e.g. `#ffffff`). All colors must be read from CSS variables (`var(--color-*)`).
- **No Hardcoded Pixel Values**: Values like `px` are forbidden for margins, paddings, font sizes, etc. (Except thin borders `1px`, `2px` and outlines `3px`). Use `rem` or space tokens.
- **No Raw Color Functions**: Using functions like `rgb()`, `rgba()`, `hsl()` is disallowed inside component files.

### Commands

- **Run local linter**: Run this command to check styles before committing:

  ```bash
  node solution-system/scripts/lint-design-tokens.mjs
  ```

- **CI/CD Guard**: Any Pull Request containing design violations will fail the [GitHub Action Workflow](.github/workflows/lint-styles.yml).
