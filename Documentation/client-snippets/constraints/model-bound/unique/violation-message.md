```typescript
import { eventType, unique } from '@cratis/chronicle';

@eventType('constraints-model-bound-message-project-created')
class CmbMessageProjectCreated {
    @unique(undefined, 'A project with this name already exists.') name = '';
    description = '';
}
```
