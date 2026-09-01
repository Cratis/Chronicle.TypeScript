```typescript
import { Constructor } from '@cratis/fundamentals';
import { EventSequenceNumber, IEventSequence } from '@cratis/chronicle';

class GettingStateObserverProgress {
    constructor(private readonly eventSequence: IEventSequence) {}

    // Uses the observer's event type filters to compute the relevant tail.
    getRelevantTail(observerType: Constructor): Promise<EventSequenceNumber> {
        return this.eventSequence.getTailSequenceNumberForObserver(observerType);
    }
}
```
