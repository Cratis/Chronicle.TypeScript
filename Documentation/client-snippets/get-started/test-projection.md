```typescript title="The projection - builds queryable state"
import { fromEvent, readModel } from '@cratis/chronicle';

@readModel()
@fromEvent(TestEvent)
class TestProjection {
    message = '';
}
```
