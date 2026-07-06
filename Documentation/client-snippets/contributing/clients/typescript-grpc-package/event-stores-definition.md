```typescript
import { EventStoresDefinition } from '@cratis/chronicle.contracts';

const eventStoresService = EventStoresDefinition.fullName;
const eventStoresMethods = Object.keys(EventStoresDefinition.methods);

console.log(`Generated service ${eventStoresService} exposes: ${eventStoresMethods.join(', ')}`);
```
