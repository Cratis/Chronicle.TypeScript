```typescript
import { CausationEntry, EventType, EventTypeGeneration } from '@cratis/chronicle';

// Illustrative subset of the real EventContext shape from '@cratis/chronicle'
interface EventProcessingEventContextShape {
    readonly sequenceNumber: bigint;
    readonly eventSourceId: string;
    readonly eventType: EventType; // Delivered generation
    readonly appendedGeneration?: EventTypeGeneration; // Original generation; undefined when unknown
    readonly occurred: Date;
    readonly correlationId: string;
    readonly causation: ReadonlyArray<CausationEntry>;
}
// ... see EventContext for the authoritative member list
```
