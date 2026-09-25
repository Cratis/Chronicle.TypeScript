```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class UcDedicatedUserRegistered {
    constructor(readonly email: string, readonly displayName: string) {}
}

@eventType()
class UcDedicatedUserEmailChanged {
    constructor(readonly newEmail: string) {}
}

@eventType()
class UcDedicatedUserRemoved {
}

@constraint('UniqueEmail')
class UcDedicatedUniqueEmail implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique =>
            unique
                .on(UcDedicatedUserRegistered, e => e.email)
                .on(UcDedicatedUserEmailChanged, e => e.newEmail)
                .ignoreCasing()
                .removedWith(UcDedicatedUserRemoved)
                .withMessage('That email address is already in use.'));
    }
}
```
