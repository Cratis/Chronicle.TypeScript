<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent, readModelReactor, ReadModelChangeset, EventForEventSourceId } from '@cratis/chronicle';

@eventType('shipment-status-changed')
class ShipmentStatusChanged {
    @field(String) status = '';
}

@eventType('shipment-notification-requested')
class ShipmentNotificationRequested {
    @field(String) status = '';
}

@fromEvent(ShipmentStatusChanged)
class ShipmentStatus {
    @field(String) status = '';
}

@readModelReactor(ShipmentStatus, 'notify-shipment-status')
class NotifyShipmentStatus {
    modified(model: ShipmentStatus, change: ReadModelChangeset<ShipmentStatus>): EventForEventSourceId {
        // Choose a domain destination explicitly; change.key is only the read-model key.
        console.log(change.namespace, change.changeContext?.sequenceNumber);
        return {
            eventSourceId: 'shipment-notifications',
            event: Object.assign(new ShipmentNotificationRequested(), { status: model.status })
        };
    }
}
```

Import or discover the reactor before requesting its event store. Add `added` or `removed` methods for those changes; there is no implicit initial snapshot. Returned events append to the changeset's namespace. The notification event deliberately does not update `ShipmentStatus`, avoiding a feedback loop.
