```typescript
import { encrypted, EncryptionScope } from '@cratis/chronicle';
import { ConceptAs } from '@cratis/fundamentals';

// One key per partner (EncryptionScope.Subject, the default).
@encrypted()
class EncryptedAttrPartnerApiKeyScoped extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}

// One key for every partner in the namespace.
@encrypted(EncryptionScope.Namespace)
class EncryptedAttrPartnerWebhookSecret extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}

// One key for the whole installation.
@encrypted(EncryptionScope.Global)
class EncryptedAttrLicenseToken extends ConceptAs<string> {
    static readonly valueType = String;

    constructor(value: string) {
        super(value);
    }
}
```
