```typescript
import { ChronicleOptions } from '@cratis/chronicle';

// ChronicleOptions.development() points at the local dev kernel on chronicle://localhost:35000
// using the built-in development client credentials.
function createConnectionStringsDevelopmentDefaults(): ChronicleOptions {
    return ChronicleOptions.development();
}
```
