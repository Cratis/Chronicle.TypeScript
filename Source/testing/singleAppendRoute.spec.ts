// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { singleAppendRoute } from './singleAppendRoute.js';

chai.should();

describe('when single-append routing rejects unsupported options', () => {
    it('should list only routing options when subject is not allowed', () => {
        (() => singleAppendRoute({ subject: 'person-a' }, 'SeededEvent'))
            .should.throw('Only sourceType, streamType, streamId options are supported for single append.');
    });

    it('should include subject in the allowed options for single append', () => {
        (() => singleAppendRoute({ tags: [] }, 'AppendedEvent', undefined, true))
            .should.throw('Only sourceType, streamType, streamId, subject options are supported for single append.');
    });
});
