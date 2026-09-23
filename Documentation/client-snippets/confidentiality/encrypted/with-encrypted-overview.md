```typescript
import { encrypted, eventType } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@encrypted()
class SecurityOverviewPartnerApiKey extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}

@eventType()
class SecurityOverviewPartnerIntegrationConfigured {
    apiKey: SecurityOverviewPartnerApiKey = new SecurityOverviewPartnerApiKey('');
}
```
