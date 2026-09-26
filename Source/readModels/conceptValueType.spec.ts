// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, Guid } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import { deserializeReadModel } from './deserializeReadModel.js';

class Cid extends ConceptAs<Guid> { static readonly valueType = Guid; }
class BirthDate extends ConceptAs<Date> { static readonly valueType = Date; }
class Concepts { cid = new Cid(Guid.empty); birth = new BirthDate(new Date(0)); }

describe('concept value restoration', () => {
    it('uses static valueType for Guid and Date without design metadata', () => {
        const concepts = deserializeReadModel(Concepts, JSON.stringify({ cid: 'f417bba6-5737-488a-a225-37da46b96221', birth: '2025-01-02T00:00:00.000Z' }));
        expect(concepts.cid).toBeInstanceOf(Cid);
        expect(concepts.cid.value).toBeInstanceOf(Guid);
        expect(concepts.birth).toBeInstanceOf(BirthDate);
        expect(concepts.birth.value).toBeInstanceOf(Date);
    });
});
