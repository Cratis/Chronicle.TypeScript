```typescript
import { eventType, reactor, startAtTail } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class WelcomeEmailRequested {
    @field(String) readonly email: string;

    constructor(email: string = '') {
        this.email = email;
    }
}

@reactor()
@startAtTail()
class SendWelcomeEmails {
    welcomeEmailRequested(event: WelcomeEmailRequested): void {
        // Runs for events appended after this reactor was first registered.
        // It does not run for the history that was already in the event log.
    }
}
```
