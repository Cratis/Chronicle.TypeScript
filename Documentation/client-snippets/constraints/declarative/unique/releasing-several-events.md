```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueSeveralInvitationSent {
    @field(String) readonly emailAddress: string;

    constructor(emailAddress: string) {
        this.emailAddress = emailAddress;
    }
}

@eventType()
class ConstraintsUniqueSeveralInvitationAccepted {
}

@eventType()
class ConstraintsUniqueSeveralInvitationRevoked {
}

@eventType()
class ConstraintsUniqueSeveralInvitationExpired {
}

@constraint()
class ConstraintsUniqueSeveralInvitedAddress implements IConstraint {
    define(builder: IConstraintBuilder): void {
        // Each removedWith() adds a release event; all distinct types are retained.
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueSeveralInvitationSent, e => e.emailAddress)
                .removedWith(ConstraintsUniqueSeveralInvitationAccepted)
                .removedWith(ConstraintsUniqueSeveralInvitationRevoked)
                .removedWith(ConstraintsUniqueSeveralInvitationExpired));
    }
}
```
