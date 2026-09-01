```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createConfigurationTlsValidationEnabled(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://my-server:35000?skipTlsValidation=false');
}
```
