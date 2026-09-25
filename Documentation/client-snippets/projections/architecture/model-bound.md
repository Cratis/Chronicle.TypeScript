```typescript
import { count, eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class ArchitectureModelBoundItemAdded {
    category = '';
}

@fromEvent(ArchitectureModelBoundItemAdded, { key: 'category' })
export class ArchitectureModelBoundSummary {
    @field(String) category = '';

    @count(ArchitectureModelBoundItemAdded)
    count = 0;
}
```
