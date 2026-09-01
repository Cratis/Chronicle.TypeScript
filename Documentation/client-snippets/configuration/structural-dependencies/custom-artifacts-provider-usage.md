```typescript
import { ChronicleOptions } from '@cratis/chronicle';

function createStructuralDependenciesCustomArtifactsProviderOptions(): ChronicleOptions {
    return ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        clientArtifactsProvider: new StructuralDepsMyArtifactsProvider()
    });
}
```
