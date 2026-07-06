```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

async function run() {
    // ChronicleOptions.development() points at the local dev kernel on chronicle://localhost:35000
    const client = new ChronicleClient(ChronicleOptions.development());
    const eventStore = await client.getEventStore('Quickstart');
    console.log(`Connected to event store: ${eventStore.name}`);

    // Use eventStore for the lifetime of your program — appending, querying, and so on.
}
```
