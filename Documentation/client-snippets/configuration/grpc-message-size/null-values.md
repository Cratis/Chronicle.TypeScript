```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createOptionsWithGrpcDefaults(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        maxReceiveMessageSize: null, // Uses gRPC default of 4 MB - not recommended
        maxSendMessageSize: null
    });
}
```
