```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';

@eventType()
class ConstraintsUniqueSeveralInvitationSent {
    constructor(readonly emailAddress: string) {}
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
        builder.unique(unique =>
            unique
                .on(ConstraintsUniqueSeveralInvitationSent, e => e.emailAddress)
                .removedWith(ConstraintsUniqueSeveralInvitationAccepted)
                .removedWith(ConstraintsUniqueSeveralInvitationRevoked)
                .removedWith(ConstraintsUniqueSeveralInvitationExpired));
    }
}
```
