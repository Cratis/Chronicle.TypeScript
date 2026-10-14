// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';

import { Address } from './Address.js';

export class Model {
    title: string | null = null;
    status = 'available';
    address = new Address();
    children = [new Address()];
}
field(String)(Model.prototype, 'title');
field(String)(Model.prototype, 'status');
field(Address)(Model.prototype, 'address');
field(Array, { genericArguments: [Address] })(Model.prototype, 'children');
