```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createChronicleOptionsConnectionString(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://myserver:35000');
}
```
