```typescript
import { identityProvider, Identity } from '@cratis/chronicle';

class CorrelationIdentityCausationIdentity {
    setForRequest(subject: string, name: string, userName: string): void {
        identityProvider.setCurrentIdentity(new Identity(subject, name, userName));
    }

    getCurrent(): Identity {
        return identityProvider.getCurrent();
    }
}
```
