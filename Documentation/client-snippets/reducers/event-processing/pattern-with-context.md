```typescript
import { EventContext } from '@cratis/chronicle';

interface EventProcessingPatternWithContext<TReadModel, TEvent> {
    // Access occurred time, correlation ID, etc.
    process(event: TEvent, current: TReadModel | undefined, context: EventContext): TReadModel;
}
```
