```typescript
import { count, eventType, fromEvent } from '@cratis/chronicle';

@eventType()
export class ArchitectureModelBoundItemAdded {
    category = '';
}

@fromEvent(ArchitectureModelBoundItemAdded, { key: 'category' })
export class ArchitectureModelBoundSummary {
    category = '';

    @count(ArchitectureModelBoundItemAdded)
    count = 0;
}
```
