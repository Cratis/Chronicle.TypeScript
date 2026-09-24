```typescript title="Declarative FromAll with a dynamic dictionary key"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class UserRegisteredForEventCounts {
    constructor(readonly name: string) {}
}

@eventType()
export class OrderPlacedForEventCounts {
    constructor(readonly orderId: string) {}
}

export class EventTypeCountsReadModel {
    eventCountByType: Record<string, number> = {};
    lastEventOccurred = new Date();
}

@projection('', EventTypeCountsReadModel)
export class EventTypeCountsProjection implements IProjectionFor<EventTypeCountsReadModel> {
    define(builder: IProjectionBuilderFor<EventTypeCountsReadModel>): void {
        builder
            .fromEvery(_ => _
                .count(m => m.eventCountByType, 'eventType')
                .set(m => m.lastEventOccurred).toEventContextProperty('occurred'));
    }
}
```
