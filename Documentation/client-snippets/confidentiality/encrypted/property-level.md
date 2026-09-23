```typescript
import { encrypted, eventType } from '@cratis/chronicle';

@eventType()
class EncryptedAttrPartnerIntegrationConfigured {
    @encrypted() apiKey = '';
    partnerName = '';
}

// When this event is written, apiKey is encrypted. partnerName is stored as plaintext.
```
