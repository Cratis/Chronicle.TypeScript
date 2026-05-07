# Event Types

Event types are the domain objects that represent things that happened in your system. They are immutable records of facts.

## Defining an Event Type

Use the `@eventType` decorator to associate a TypeScript class with a unique Chronicle event type identifier:

```typescript
import { eventType } from '@cratis/chronicle';

@eventType('aa7faa25-afc1-48d1-8558-716581c0e916', 1)
class EmployeeHired {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string
    ) {}
}
```

The first argument is a UUID that uniquely identifies the event type. The second argument is the generation number (defaults to 1).

## Rules for Event Types

- Events are **immutable facts** — never add nullable properties; instead, create a new event type.
- The UUID must be globally unique and stable — never change it after first use.
- The generation number must increase when the schema changes.
- Event type classes should only contain constructor parameters; no business logic.

## Accessing Event Type Metadata

You can retrieve the event type metadata for a class at runtime:

```typescript
import { getEventTypeFor } from '@cratis/chronicle';

const eventTypeInfo = getEventTypeFor(EmployeeHired);
console.log(eventTypeInfo.id.value);         // 'aa7faa25-...'
console.log(eventTypeInfo.generation.value); // 1
```
