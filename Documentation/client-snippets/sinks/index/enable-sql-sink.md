```typescript
import { ChronicleOptions, WellKnownSinks } from '@cratis/chronicle';

function createSinksSqlOptions(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        defaultSinkTypeId: WellKnownSinks.SQL
    });
}
```
