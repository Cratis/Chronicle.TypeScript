```typescript
import { ChronicleClient } from '@cratis/chronicle';

// TypeScript has no DI-container registration step for compliance support - the PII manager
// is available automatically as soon as you have an event store, with no separate wiring.
async function getPIIManager(chronicleClient: ChronicleClient) {
    const eventStore = await chronicleClient.getEventStore('Sales');
    return eventStore.pii;
}
```
