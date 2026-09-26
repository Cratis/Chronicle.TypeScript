```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueNamedUserRegistered {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
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
