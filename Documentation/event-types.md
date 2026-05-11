# Event Types

Event types are the domain objects that represent things that happened in your system. They are immutable records of facts.

## Defining an Event Type

Use the `@eventType` decorator to mark a class as an event type:

```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class EmployeeHired {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string
    ) {}
}
```

By default, Chronicle uses the class name as the event type id, generation `1`, and tombstone `false`.

You can optionally provide generation and tombstone:

```typescript
@eventType(2)
class EmployeeHiredV2 {}

@eventType(true)
class EmployeeRetired {}
```

## Rules for Event Types

- Events are **immutable facts** — never add nullable properties; instead, create a new event type.
- Keep class names stable because the default id comes from the class name.
- Increase generation when the schema changes.
- Event type classes should only contain constructor parameters; no business logic.

## Accessing Event Type Metadata

You can retrieve the event type metadata for a class at runtime:

```typescript
import { getEventTypeFor } from '@cratis/chronicle';

const eventTypeInfo = getEventTypeFor(EmployeeHired);
console.log(eventTypeInfo.id.value);         // 'EmployeeHired'
console.log(eventTypeInfo.generation.value); // 1
```
