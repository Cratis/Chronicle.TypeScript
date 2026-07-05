```typescript
import { count, eventType, fromEvent, readModel } from '@cratis/chronicle';

@eventType()
class ArchitectureModelBoundItemAdded {
    category = '';
}

@readModel()
@fromEvent(ArchitectureModelBoundItemAdded, { key: 'category' })
class ArchitectureModelBoundSummary {
    category = '';

    @count(ArchitectureModelBoundItemAdded)
    count = 0;
}
```
