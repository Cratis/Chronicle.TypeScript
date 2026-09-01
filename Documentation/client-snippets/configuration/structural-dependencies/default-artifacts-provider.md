```typescript
import { DefaultClientArtifactsProvider, TypeDiscoverer } from '@cratis/chronicle';

// TypeScript discovers artifacts by scanning files matching glob patterns rather than
// scanning loaded assemblies - TypeDiscoverer.default is backed by ChronicleOptions'
// discoveryPatterns.
function createStructuralDependenciesDefaultArtifactsProvider(): DefaultClientArtifactsProvider {
    return new DefaultClientArtifactsProvider(TypeDiscoverer.default);
}
```
