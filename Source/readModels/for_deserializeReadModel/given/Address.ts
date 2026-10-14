// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';

export class Address {
    street = 'Default street';
    city: string | null = null;
}
field(String)(Address.prototype, 'street');
field(String)(Address.prototype, 'city');
