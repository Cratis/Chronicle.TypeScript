```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createConnectionStringsFromConnectionString(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://myserver:35000');
}
```
