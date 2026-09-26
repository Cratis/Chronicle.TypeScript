```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class UcDedicatedUserRegistered {
    @field(String) readonly email: string;
    @field(String) readonly displayName: string;

    constructor(email: string, displayName: string) {
        this.email = email;
        this.displayName = displayName;
    }
}

@eventType()
class UcDedicatedUserEmailChanged {
    @field(String) readonly newEmail: string;

    constructor(newEmail: string) {
        this.newEmail = newEmail;
    }
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
