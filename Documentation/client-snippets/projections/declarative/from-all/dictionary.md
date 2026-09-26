```typescript title="Declarative FromAll with a dynamic dictionary key"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserRegisteredForEventCounts {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
export class OrderPlacedForEventCounts {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
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
