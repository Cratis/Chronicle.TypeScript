```typescript
import { ChronicleOptions, WellKnownSinks } from '@cratis/chronicle';

function createChronicleOptionsSqlSink(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        defaultSinkTypeId: WellKnownSinks.SQL
    });
}
```
