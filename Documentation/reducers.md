# Reducers

Reducers observe events from an event sequence and fold them into a read model (state). Unlike reactors, they produce state — they are the "how did we get here" of event sourcing.

## Defining a Reducer

Use the `@reducer` decorator to mark a class as a reducer:

```typescript
import { reducer, EventContext, eventType } from '@cratis/chronicle';

interface EmployeeState {
    firstName: string;
    lastName: string;
    title: string;
}

@eventType()
class EmployeeHired {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string
    ) {}
}

@eventType()
class EmployeePromoted {
    constructor(readonly newTitle: string) {}
}

@reducer()
class EmployeeStateReducer {
    async employeeHired(event: EmployeeHired, state?: EmployeeState): Promise<EmployeeState> {
        return { firstName: event.firstName, lastName: event.lastName, title: event.title };
    }

    async employeePromoted(event: EmployeePromoted, state?: EmployeeState): Promise<EmployeeState> {
        return { ...state!, title: event.newTitle };
    }
}
```

## Rules for Reducers

1. **Pure functions** — Given the same event and state, always return the same new state.
2. **Handle undefined state** — The initial state may be `undefined` (no events yet). Handle this case gracefully.
3. **Single read model** — A reducer produces a single read model type. Build multiple reducers for different views.

## Method Dispatch

Method dispatch is by convention: the first parameter type of each public method determines which events it handles. The second parameter is the current state (may be `undefined` for the first event).
