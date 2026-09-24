```typescript title="The projection - builds queryable state"
import { fromEvent } from '@cratis/chronicle';

@fromEvent(TestEvent)
export class TestProjection {
    message = '';
}
```
