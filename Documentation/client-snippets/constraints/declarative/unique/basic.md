```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueProjectCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
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
