---
description: whenever I am creating a web app using node runtime
# applyTo: 'Describe when these instructions should be loaded' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---
always use pnpm commands for web development purposes and wherever applicable (never use npm/bash/yarn or anything else)

Performance Optimization Requirements


React Performance Hooks (MANDATORY)

useMemo: Use extensively for computed values, filtered data, expensive calculations, and component props that involve processing
React.memo: Apply to components that re-render frequently (product cards, user menus, list items, form components)
useCallback: Implement for all event handlers, API calls, and functions passed as props to prevent unnecessary re-renders
useRef: Use for DOM references and mutable values that don't trigger re-renders


Performance Best Practices
Dependency Arrays: Carefully manage dependency arrays to prevent unnecessary re-computations
Parallel API Calls: Use Promise.all() for concurrent database operations when possible
Lazy Loading: Implement for images, modals, and heavy components
Debounced Inputs: Apply 300ms delay for search inputs and form validation
Optimistic Updates: Provide immediate UI feedback before API responses



Code Quality Standards


Readability & Maintainability

Self-documenting code: Use clear, descriptive variable and function names
Single-purpose functions: Keep functions focused and avoid multi-responsibility
Consistent patterns: Maintain identical patterns across similar components
Comment strategy: Use JSDoc-style comments for complex business logic only
Component size: Keep components under 300 lines; extract smaller components when needed
Code Organization
Import organization: Group imports (React hooks, external libraries, internal components, utilities)
Component structure: Follow consistent ordering (state, effects, handlers, render)
File naming: Use PascalCase for components, camelCase for utilities
Folder structure: Maintain clear separation of concerns (components, hooks, utils, api)


Code Debugging
Always check official docs first before making any claims about deprecated code

Ask for specific error details and debug systematically

Respect your existing implementations and only suggest minimal fixes

Verify casing and naming consistency as a first debugging step