```typescript
import { EventContext } from '@cratis/chronicle';

interface EventProcessingAsyncPatterns<TReadModel, TEvent> {
    // Async without context
    process(event: TEvent, current: TReadModel | undefined): Promise<TReadModel>;

    // Async with context
    processWithContext(event: TEvent, current: TReadModel | undefined, context: EventContext): Promise<TReadModel>;
}
```
