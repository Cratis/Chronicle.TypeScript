```typescript
import { encrypted } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

@encrypted()
class EncryptedAttrPartnerApiKey extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}

class EncryptedAttrPartnerIntegrationConfiguredWithKey {
    apiKey: EncryptedAttrPartnerApiKey = new EncryptedAttrPartnerApiKey('');
}
```
