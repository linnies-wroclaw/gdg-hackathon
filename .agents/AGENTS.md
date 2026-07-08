# Project Rules & Customizations

This file outlines project-specific rules that coding agents MUST follow when working on the workspace.

## CSS/SCSS & Design System Rules

1. **Strict View Encapsulation**: Never style sub-elements of a child component inside a parent component's stylesheet. Styles for components like `ChatSidebarComponent`, `ChatMessageComponent`, and `SolutionTraceComponent` must be completely isolated in their own SCSS files or placed in global component styles.
2. **Three-Tier Tokenization**: Never write raw hex codes or magic values (margins, padding, radii) in component stylesheets. Always use design tokens from the semantic layer (`var(--color-primary)`, `var(--color-border)`, etc.) which references primitives.
3. **Host Styling**: Style root containers using the host component properties (`host: { class: '...' }`) and the `:host` SCSS selector, rather than wrapping layouts in redundant HTML containers.
4. **Global Chat Components**: Shared chat UI components (like bubbles, messages, and typing dots) must be maintained globally in `src/styles/components/_chat.scss`.
