```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createConnectionStringsDevelopmentDefaultsEquivalent(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString(
        'chronicle://chronicle-dev-client:chronicle-dev-secret@localhost:35000'
    );
}
```
