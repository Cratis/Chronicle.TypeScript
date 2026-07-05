```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueCasingUserRegistered {
    constructor(readonly email: string) {}
}

@constraint()
class ConstraintsUniqueCasingEmail implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueCasingUserRegistered, e => e.email)
                .ignoreCasing());
    }
}
```
