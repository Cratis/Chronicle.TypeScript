```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createOptionsWithLargerMessages(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        maxReceiveMessageSize: 200 * 1024 * 1024, // 200 MB
        maxSendMessageSize: 200 * 1024 * 1024 // 200 MB
    });
}
```
