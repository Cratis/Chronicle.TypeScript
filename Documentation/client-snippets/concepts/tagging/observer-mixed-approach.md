```typescript
import { reactor, tag, tags } from '@cratis/chronicle';

@reactor()
@tag('Notifications', 'SMS')
@tags('Customer')
class TaggingSmsNotificationReactor {}

// Or mix single and multiple attributes the other way around
@reactor()
@tag('Integration')
@tags('ExternalAPI', 'Inventory')
class TaggingInventorySyncReactorMixed {}
```
