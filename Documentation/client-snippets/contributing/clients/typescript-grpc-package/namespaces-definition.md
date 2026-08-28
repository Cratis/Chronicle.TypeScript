```typescript
import { NamespacesDefinition } from '@cratis/chronicle.contracts';

const allNamespacesMethod = NamespacesDefinition.methods.allNamespaces;

console.log(`${NamespacesDefinition.fullName}.${allNamespacesMethod.name}`);
```
