<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, fromEvent, tag } from '@cratis/chronicle';

@eventType()
class TaggingProductRegistered {
    productId = '';
    name = '';
    quantityInStock = 0;
    unitPrice = 0;
}

@tag('Inventory', 'Operations')
@fromEvent(TaggingProductRegistered, { key: 'productId' })
class TaggingProductInventory {
    productId = '';
    name = '';
    quantityInStock = 0;
    unitPrice = 0;
}
```
