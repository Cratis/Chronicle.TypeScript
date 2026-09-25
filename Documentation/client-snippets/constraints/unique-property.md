<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, unique, removeConstraint } from '@cratis/chronicle';

@eventType('sdk-user-registered')
class SdkUserRegistered {
    @unique('UniqueEmail') email = '';
}

@eventType('sdk-user-email-changed')
class SdkUserEmailChanged {
    @unique('UniqueEmail') newEmail = '';
}

@eventType('sdk-user-deleted')
@removeConstraint('UniqueEmail')
class SdkUserDeleted {}

@eventType('sdk-user-anonymized')
@removeConstraint('UniqueEmail')
class SdkUserAnonymized {}
```
