```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

async function runConfigurationIndexRegistrationExample(): Promise<void> {
    const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000'));
    const eventStore = await client.getEventStore('my-store');
}
```
