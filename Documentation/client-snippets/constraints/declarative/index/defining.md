```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsDeclarativeIndexProjectCreated {
    constructor(readonly name: string) {}
}

@eventType()
class ConstraintsDeclarativeIndexProjectRemoved {
}

@constraint()
class ConstraintsDeclarativeIndexUniqueProjectName implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(ConstraintsDeclarativeIndexProjectCreated, e => e.name)
                .removedWith(ConstraintsDeclarativeIndexProjectRemoved));
    }
}
```
