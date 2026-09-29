```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createChronicleOptionsReadModelNamingPolicy(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        // Name each read model's container (the MongoDB collection) after its lower-cased class name.
        // The policy gets the read model identifier and, when the client knows it, the read model class.
        readModelNamingPolicy: (identifier, readModelType) => (readModelType?.name ?? identifier).toLowerCase()
    });
}
```
