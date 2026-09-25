```typescript
import { eventType, unique } from '@cratis/chronicle';

@eventType('constraints-model-bound-project-created')
class CmbProjectCreated {
    @unique() name = '';
    description = '';
}
```
