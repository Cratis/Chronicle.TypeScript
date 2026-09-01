```typescript
import { reactor, tag } from '@cratis/chronicle';

@reactor()
// By integration type
@tag('Notifications', 'ExternalAPI', 'MessageQueue', 'FileSystem')
// By domain
@tag('Sales', 'Inventory', 'Customer', 'Shipping')
// By communication channel
@tag('Email', 'SMS', 'Push', 'Webhook')
// By purpose
@tag('Integration', 'Alerting', 'Monitoring', 'Automation')
// By stakeholder
@tag('Customer', 'Operations', 'Finance', 'Support')
class TaggingReactorsCategoryExamplesReactor {}
```
