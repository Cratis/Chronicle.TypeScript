<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, unique, removeConstraint } from '@cratis/chronicle';

@eventType('sdk-account-registered')
@unique('UniqueAccount')
class SdkAccountRegistered {}

@eventType('sdk-account-closed')
@removeConstraint('UniqueAccount')
class SdkAccountClosed {}

@eventType('sdk-account-reopened')
@removeConstraint('UniqueAccount')
class SdkAccountReopened {}
```
