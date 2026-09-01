```typescript
import { nested } from '@cratis/chronicle';

class NestedPropertyChild {
    name = '';
    description = '';
}

class ParentWithNestedProperty {
    @nested
    child: NestedPropertyChild | null = null;
}
```
