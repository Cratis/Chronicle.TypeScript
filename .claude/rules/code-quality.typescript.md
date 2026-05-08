---
applyTo: "**/*.ts,**/*.tsx"
---

# Code Quality — TypeScript

TypeScript/Node.js-specific applications of the general [Code Quality](./code-quality.md) principles.

## Composition over Inheritance

Avoid class hierarchies; compose behavior through interfaces and dependency injection instead.

**Rules:**
- Never use class inheritance for services or handlers — compose with injected dependencies instead.
- Extract repeated logic into focused helper functions or composable services.

## Open/Closed Principle

TypeScript discriminated unions and generic constraints let you add new variants without touching existing code.

```ts
// ✅ Adds new event types without modifying existing code
type EventResult =
    | { kind: 'success'; sequenceNumber: number }
    | { kind: 'violation'; constraintViolations: ConstraintViolation[] };
```

## Separation of Concerns

**Rules:**
- Never write infrastructure concerns (gRPC calls) directly in domain logic — abstract through interfaces.
- Keep event type metadata separate from event payload definitions.

## Low Coupling

**Rules:**
- Import from barrel `index.ts` files, not from deep internal paths.
- Never import from an unrelated feature's internal files — go through that feature's public barrel export.
