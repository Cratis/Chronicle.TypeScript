```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueUserRegistered {
    constructor(readonly email: string) {}
}

@eventType()
class ConstraintsUniqueUserEmailChanged {
    constructor(readonly newEmail: string) {}
}

@eventType()
class ConstraintsUniqueUserRemoved {
}

@constraint()
class ConstraintsUniqueEmailAcrossEvents implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .withName('UniqueEmail')
                .on(ConstraintsUniqueUserRegistered, e => e.email)
                .on(ConstraintsUniqueUserEmailChanged, e => e.newEmail)
                .removedWith(ConstraintsUniqueUserRemoved));
    }
}
```
