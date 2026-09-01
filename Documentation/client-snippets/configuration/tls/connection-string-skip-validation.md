```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createTlsConnectionStringSkipValidation(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000?skipTlsValidation=true');
}
```
