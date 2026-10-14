// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';

export class IdentityDefaults {
    original = {};
    mirror = this.original;
    owner = this;
    name = 'default';
}
field(Object)(IdentityDefaults.prototype, 'mirror');
field(Object)(IdentityDefaults.prototype, 'owner');
field(String)(IdentityDefaults.prototype, 'name');
