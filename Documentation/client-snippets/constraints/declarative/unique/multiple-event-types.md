```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueUserRegistered {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

@eventType()
class ConstraintsUniqueUserEmailChanged {
    @field(String) readonly newEmail: string;

    constructor(newEmail: string) {
        this.newEmail = newEmail;
    }
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
