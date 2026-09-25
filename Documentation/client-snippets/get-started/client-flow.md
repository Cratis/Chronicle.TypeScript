```typescript title="index.ts"
import 'reflect-metadata';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

// discoveryPatterns: [] registers the artifacts this module imports instead of scanning source files.
const client = new ChronicleClient(ChronicleOptions.development({ discoveryPatterns: [] }));
const eventStore = await client.getEventStore('ChronicleConsole');

await eventStore.eventLog.append('some-event-source', new TestEvent('Hello world!'));
```
