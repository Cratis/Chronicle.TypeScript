```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

async function run() {
    // ChronicleOptions.development() connects to the local development kernel on localhost:35000
    // with the development credentials.
    const client = new ChronicleClient(ChronicleOptions.development());
    try {
        const eventStore = await client.getEventStore('Quickstart');
        console.log(`Connected to event store: ${eventStore.name}`);

        // Use eventStore for the lifetime of your program — appending, querying, and so on.
    } finally {
        client.dispose();
    }
}

await run();
```
