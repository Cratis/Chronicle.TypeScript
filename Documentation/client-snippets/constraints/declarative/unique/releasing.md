```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueOrderPlaced {
    constructor(readonly reference: string) {}
}

@eventType()
class ConstraintsUniqueOrderCancelled {
}

@constraint()
class ConstraintsUniqueOrderReference implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueOrderPlaced, e => e.reference)
                .removedWith(ConstraintsUniqueOrderCancelled));
    }
}
```
