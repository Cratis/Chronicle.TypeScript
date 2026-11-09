```typescript
import { BatchContext, EventBatch, eventType, observes, reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';
import { field } from '@cratis/fundamentals';

@eventType('parcel-shipped')
class ParcelShipped {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string = '') {
        this.trackingNumber = trackingNumber;
    }
}

const registered: string[][] = [];

@reactor('parcel-tracking')
class ParcelTracking {
    @observes(ParcelShipped)
    async register(batch: EventBatch, _context: BatchContext): Promise<void> {
        const shipped = batch.ofType(ParcelShipped);
        registered.push(shipped.map(parcel => parcel.event.trackingNumber));
        for (const parcel of shipped.filter(parcel => parcel.event.trackingNumber === 'TRACK-2')) {
            batch.fail(parcel.context, new Error(`The carrier rejected parcel '${parcel.event.trackingNumber}'`));
        }
    }
}

const parcelScenario = new ReactorScenario(ParcelTracking, { artifacts: { eventTypes: [ParcelShipped] }, constraints: 'disabled' });
await parcelScenario.given.page(
    { eventSourceId: 'parcel-1', event: new ParcelShipped('TRACK-1') },
    { eventSourceId: 'parcel-2', event: new ParcelShipped('TRACK-2') });

// Both parcels reached the batch method in one call: registered is [['TRACK-1', 'TRACK-2']].
parcelScenario.shouldHaveFailed('parcel-2');
// partitionOutcomes holds only the failed parcel.
```
