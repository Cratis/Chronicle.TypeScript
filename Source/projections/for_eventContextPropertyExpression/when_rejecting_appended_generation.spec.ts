// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventContextPropertyExpression } from '../eventContextPropertyExpression.js';
import { InvalidEventContextPropertyError } from '../InvalidEventContextPropertyError.js';

chai.should();

describe('when using appended generation as a projection context property', () => {
    it('should reject the metadata rather than introduce an unsupported projection expression', () => {
        for (const path of ['appendedGeneration', 'AppendedGeneration', 'appendedGeneration.value']) {
            (() => eventContextPropertyExpression(path)).should.throw(InvalidEventContextPropertyError);
        }
    });
});
