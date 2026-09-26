```typescript
import { eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingInvalidDataDetected {
    @field(String) readonly reason: string;

    constructor(reason: string) {
        this.reason = reason;
    }
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
