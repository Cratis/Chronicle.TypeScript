```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder, Guid } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsPersonAliasedTo {
    @field(Guid) readonly target: Guid;

    constructor(target: Guid) {
        this.target = target;
    }
}

@eventType()
class ConstraintsPersonErased {
}

@constraint()
class ConstraintsPersonTerminalOutcome implements IConstraint {
    // Both declarations share one constraint name, so they become a single constraint:
    // at most one event drawn from { ConstraintsPersonAliasedTo, ConstraintsPersonErased }
    // per person. A person merged away can no longer be erased, and neither event can
    // occur twice.
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(ConstraintsPersonAliasedTo, 'This person already has a terminal outcome.', 'PersonTerminal');
        builder.uniqueFor(ConstraintsPersonErased, 'This person already has a terminal outcome.', 'PersonTerminal');
    }
}
```
