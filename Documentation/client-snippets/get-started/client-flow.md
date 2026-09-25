```typescript title="index.ts"
import 'reflect-metadata';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const client = new ChronicleClient(ChronicleOptions.development());
const eventStore = await client.getEventStore('ChronicleConsole');

await eventStore.eventLog.append('some-event-source', new TestEvent('Hello world!'));
```
