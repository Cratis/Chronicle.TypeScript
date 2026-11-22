```typescript
import { ChronicleClient, ChronicleOptions, eventType, type EventEnrichmentProvider } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('EnrichedOrderPlaced')
class EnrichedOrderPlaced {
    @field(String) readonly orderNumber: string;
    @field(String) readonly recordedInNamespace: string;

    constructor(orderNumber: string, recordedInNamespace = '') {
        this.orderNumber = orderNumber;
        this.recordedInNamespace = recordedInNamespace;
    }
}

async function appendEnrichedOrder(): Promise<void> {
    const recordNamespace: EventEnrichmentProvider = (content, context) => {
        content.recordedInNamespace = context.namespace;
    };

    const client = new ChronicleClient(ChronicleOptions.fromConnectionString(
        'chronicle://localhost:35000',
        { eventEnrichmentProviders: [recordNamespace] }
    ));
    try {
        const store = await client.getEventStore('Orders', 'sales');
        const result = await store.eventLog.append('order-123', new EnrichedOrderPlaced('123'));
        if (!result.isSuccess) {
            throw new Error('Order was not appended');
        }
    } finally {
        client.dispose();
    }
}
```
