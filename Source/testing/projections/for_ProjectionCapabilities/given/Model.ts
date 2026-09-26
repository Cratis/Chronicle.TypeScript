// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';

export class Model { id!: string; name!: string; quantity!: number; total!: number; state!: string; labels!: string[]; details!: object; }
field(String)(Model.prototype, 'id');
field(String)(Model.prototype, 'name');
field(Number)(Model.prototype, 'quantity');
field(Number)(Model.prototype, 'total');
field(String)(Model.prototype, 'state');
field(Array)(Model.prototype, 'labels');
field(Object)(Model.prototype, 'details');
