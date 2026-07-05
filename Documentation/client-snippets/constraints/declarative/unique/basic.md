```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueProjectCreated {
    constructor(readonly name: string) {}
}

@eventType()
class ConstraintsUniqueProjectRemoved {
}

@constraint()
class ConstraintsUniqueProjectName implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueProjectCreated, e => e.name)
                .removedWith(ConstraintsUniqueProjectRemoved));
    }
}
```
