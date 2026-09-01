```typescript
import { eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingInvalidDataDetected {
    constructor(readonly reason: string) {}
}

class EventProcessingValidationResult {
    isValid = true;
    errors: string[] = [];
}

@reducer('', undefined, EventProcessingValidationResult)
class EventProcessingValidationResultReducer {
    eventProcessingInvalidDataDetected(
        event: EventProcessingInvalidDataDetected,
        current: EventProcessingValidationResult | undefined
    ): EventProcessingValidationResult {
        const errors = [...(current?.errors ?? []), event.reason];

        return { isValid: false, errors };
    }
}
```
