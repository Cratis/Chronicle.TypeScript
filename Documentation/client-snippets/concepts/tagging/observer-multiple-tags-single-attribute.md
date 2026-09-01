```typescript
import { reactor, tag, tags } from '@cratis/chronicle';

@reactor()
@tag('Notifications', 'Customer', 'Email')
class TaggingCustomerNotificationReactor {}

// @tags() (plural) is equivalent — use whichever reads more naturally
@reactor()
@tags('Notifications', 'Customer', 'Email')
class TaggingCustomerNotificationReactorAlternate {}
```
