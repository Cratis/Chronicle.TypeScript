```typescript
import { ChronicleOptions, WellKnownSinks } from '@cratis/chronicle';

// Neo4j is the default. The InMemoryGraph sink keeps the graph in the kernel's memory.
export const graphSinkOptions = ChronicleOptions.fromConnectionString(
    'chronicle://localhost:35000',
    { defaultGraphSinkTypeId: WellKnownSinks.InMemoryGraph });
```
