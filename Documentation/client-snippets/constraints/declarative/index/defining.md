```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsDeclarativeIndexProjectCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
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
