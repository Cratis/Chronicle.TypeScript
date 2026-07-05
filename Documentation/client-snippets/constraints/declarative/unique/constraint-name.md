```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueNamedUserRegistered {
    constructor(readonly email: string) {}
}

@constraint()
class ConstraintsUniqueNamedEmail implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .withName('UniqueEmail')
                .on(ConstraintsUniqueNamedUserRegistered, e => e.email));
    }
}
```
