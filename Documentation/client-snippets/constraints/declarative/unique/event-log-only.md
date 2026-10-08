```typescript
import { constraint, eventType, IConstraint, IConstraintBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConstraintsUniqueEventLogInvitationSent {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

@eventType()
class ConstraintsUniqueEventLogInvitationRevoked {
}

@constraint()
class ConstraintsUniqueEventLogInvitationEmail implements IConstraint {
    // InvitationSent is also forwarded to the outbox. Scope the constraint to the event log
    // so the forwarded copy does not claim the email in the outbox's own index.
    define(builder: IConstraintBuilder): void {
        builder
            .forEventLog()
            .unique(unique =>
                unique
                    .on(ConstraintsUniqueEventLogInvitationSent, e => e.email)
                    .removedWith(ConstraintsUniqueEventLogInvitationRevoked));
    }
}
```
