```typescript
import { eventType, EventSequenceId, removeConstraint, unique } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
@removeConstraint('ConstraintsModelBoundUniqueEventLogInvitationEmail')
class ConstraintsModelBoundUniqueEventLogInvitationRevoked {
}

@eventType()
class ConstraintsModelBoundUniqueEventLogInvitationSent {
    // Scoped to the event log, so a copy forwarded to the outbox does not claim the email there.
    @unique({ name: 'ConstraintsModelBoundUniqueEventLogInvitationEmail', eventSequences: [EventSequenceId.eventLog] })
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}
```
