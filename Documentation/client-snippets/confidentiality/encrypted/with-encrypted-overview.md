```typescript
import { encrypted, eventType } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@encrypted()
class SecurityOverviewPartnerApiKey extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}

@eventType()
class SecurityOverviewPartnerIntegrationConfigured {
    apiKey: SecurityOverviewPartnerApiKey = new SecurityOverviewPartnerApiKey('');
}
```
