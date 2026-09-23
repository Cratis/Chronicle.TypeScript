```typescript
import { encrypted } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@encrypted()
class EncryptedAttrPartnerApiKey extends ConceptAs<string> {
    constructor(value: string) {
        super(value);
    }
}

class EncryptedAttrPartnerIntegrationConfiguredWithKey {
    apiKey: EncryptedAttrPartnerApiKey = new EncryptedAttrPartnerApiKey('');
}
```
