```typescript
import { EncryptionScope } from '@cratis/chronicle';

// EncryptionScope is exported by @cratis/chronicle and has exactly these three members.
const encryptionScopeKeyBoundaries: Record<EncryptionScope, string> = {
    [EncryptionScope.Subject]: 'per compliance identity - the default',
    [EncryptionScope.Namespace]: 'one key shared by every value marked this way in the event store namespace',
    [EncryptionScope.Global]: 'one key shared by every value marked this way across the whole installation'
};
```
