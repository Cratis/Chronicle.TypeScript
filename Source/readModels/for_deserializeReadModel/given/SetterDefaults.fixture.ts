// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';

export class SetterDefaults {
    sibling = 'default';
    assignments = 0;
    private _name = 'default';

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this.assignments++;
        this._name = `prefix:${value}`;
    }
}
field(String)(SetterDefaults.prototype, 'name');
field(String)(SetterDefaults.prototype, 'sibling');
