```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueOrderPlaced {
    @field(String) readonly reference: string;

    constructor(reference: string) {
        this.reference = reference;
    }
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
