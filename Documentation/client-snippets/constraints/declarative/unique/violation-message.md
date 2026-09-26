```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueMessageProjectCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
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
