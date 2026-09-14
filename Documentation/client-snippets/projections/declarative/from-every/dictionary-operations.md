```typescript title="Dictionary operations with fromEvery"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class ItemAddedToDictionary {
    constructor(readonly quantity: number) {}
}

@eventType()
class ItemRemovedFromDictionary {
    constructor(readonly quantity: number) {}
}

@eventType()
class OrderProcessedDictionary {
    constructor(readonly orderId: string) {}
}

@readModel()
class EventStatisticsDictionary {
    // Count occurrences of each event type
    eventCounts: Record<string, number> = {};
    
    // Track increments per event type
    eventIncrements: Record<string, number> = {};
    
    // Track decrements per correlation ID
    decrementsByCorrelation: Record<string, number> = {};
}

@projection('', EventStatisticsDictionary)
class EventStatisticsDictionaryProjection implements IProjectionFor<EventStatisticsDictionary> {
    define(builder: IProjectionBuilderFor<EventStatisticsDictionary>): void {
        builder
            .from(ItemAddedToDictionary)
            .from(ItemRemovedFromDictionary)
            .from(OrderProcessedDictionary)
            .fromEvery(_ => _
                // Count each event type occurrence
                .count(m => m.eventCounts, 'eventType')
                
                // Increment per event type
                .increment(m => m.eventIncrements, 'eventType')
                
                // Decrement by correlation ID
                .decrement(m => m.decrementsByCorrelation, 'correlationId'));
    }
}
```

## How it works

The `count()`, `increment()`, and `decrement()` methods on the `fromEvery` builder accept two parameters:

1. **Property accessor** — points to a dictionary property on the read model (type `Record<string, number>`)
2. **Event context property name** — the name of the event context property to use as the dictionary key (e.g., `'eventType'`, `'correlationId'`)

For each event:
- The kernel resolves the dynamic key from the specified event context property
- The operation (`$count`, `$increment`, or `$decrement`) is applied to the dictionary entry at that key
- If the key doesn't exist, it is created with an initial value (0 for count/increment, 0 for decrement)

### Wire format

The above example produces a projection definition with this structure in the `All.Properties` section:

```json
{
  "eventCounts.$eventContext.eventType": "$count",
  "eventIncrements.$eventContext.eventType": "$increment",
  "decrementsByCorrelation.$eventContext.correlationId": "$decrement"
}
```

### Common use cases

- **Event type statistics** — count how many events of each type have been processed
- **Correlation tracking** — track activity per correlation ID
- **Causation analysis** — aggregate by causation ID
- **Custom context fields** — use any event context property as a grouping key
