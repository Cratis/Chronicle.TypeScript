```typescript
import { DefaultClientArtifactsProvider, TypeDiscoverer } from '@cratis/chronicle';

// TypeScript artifacts register with TypeDiscoverer.default when their decorated classes load.
// ChronicleOptions' discoveryPatterns can also import files that match glob patterns.
function createStructuralDependenciesDefaultArtifactsProvider(): DefaultClientArtifactsProvider {
    return new DefaultClientArtifactsProvider(TypeDiscoverer.default);
}
```
