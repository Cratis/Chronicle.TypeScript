```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';

class BookingCancelled {
    @field(String) bookingId: string;
    constructor(bookingId: string) { this.bookingId = bookingId; }
}
eventType('BookingCancelled')(BookingCancelled);
const notified: string[] = [];
class CancellationReactor {
    constructor(private readonly notifications: { notify(message: string): Promise<void> }) {}
    bookingCancelled(event: BookingCancelled): Promise<void> {
        return this.notifications.notify(`Booking ${event.bookingId} was cancelled.`);
    }
}
reactor('CancellationReactor')(CancellationReactor);
// The artifact activator supplies the reactor's dependencies, as the production client's hook does.
const cancellationScenario = new ReactorScenario(CancellationReactor, {
    artifacts: { eventTypes: [BookingCancelled] }, constraints: 'disabled',
    artifactActivator: type => ({ instance: new type({ notify: async (message: string) => { notified.push(message); } }) })
});
await cancellationScenario.given.forEventSource('booking-123').events(new BookingCancelled('booking-123'));
// notified contains 'Booking booking-123 was cancelled.'
```
