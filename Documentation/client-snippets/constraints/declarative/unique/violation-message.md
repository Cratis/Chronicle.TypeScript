```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueMessageProjectCreated {
    constructor(readonly name: string) {}
}

@constraint()
class ConstraintsUniqueMessageProjectName implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueMessageProjectCreated, e => e.name)
                .withMessage('A project with this name already exists.'));
    }
}
```
