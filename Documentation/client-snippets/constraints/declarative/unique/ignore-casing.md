```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueCasingUserRegistered {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
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
