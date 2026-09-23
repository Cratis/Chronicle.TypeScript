```typescript
import { encrypted, EncryptionScope, eventType } from '@cratis/chronicle';

// encrypted(scope: EncryptionScope = EncryptionScope.Subject, details?: string): PropertyDecorator & ClassDecorator
// Apply it to a class (a concept type) or to a property. Both arguments are optional.
@eventType()
class EncryptedMarkerPartnerIntegrationConfigured {
    @encrypted(EncryptionScope.Subject, 'Partner API credential - an operational secret with no data subject')
    apiKey = '';
}
```
