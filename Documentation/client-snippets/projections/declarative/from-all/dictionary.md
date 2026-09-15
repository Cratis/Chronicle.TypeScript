```typescript title="Declarative FromAll with a dynamic dictionary key"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class UserRegisteredForEventCounts {
    constructor(readonly name: string) {}
}

@eventType()
class OrderPlacedForEventCounts {
    constructor(readonly orderId: string) {}
}

@readModel()
class EventTypeCountsReadModel {
    eventCountByType: Record<string, number> = {};
    lastEventOccurred = new Date();
}

@projection('', EventTypeCountsReadModel)
class EventTypeCountsProjection implements IProjectionFor<EventTypeCountsReadModel> {
    define(builder: IProjectionBuilderFor<EventTypeCountsReadModel>): void {
        builder
            .fromEvery(_ => _
                .count(m => m.eventCountByType, 'eventType')
                .set(m => m.lastEventOccurred).toEventContextProperty('occurred'));
    }
}
```
