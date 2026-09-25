// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { onceOnly, isOnceOnly } from './onceOnly.js';
import { replay, getReplayEventType } from './replay.js';
import { replayable, isReplayable } from './replayable.js';

class EventForReplay {}

@onceOnly()
@replayable()
class StandardReactor {
    @onceOnly()
    eventForReplay() {}

    @replay()
    replayEventForReplay() {}

    @replay(EventForReplay)
    rebuild() {}
}

@replayable()
class OptedInReactor {}

describe('standard reactor policy decorators', () => {
    it('marks the class independently of its handlers', () => {
        expect(isOnceOnly(StandardReactor)).toBe(true);
        expect(isReplayable(StandardReactor)).toBe(true);
        expect(isOnceOnly(OptedInReactor)).toBe(false);
        expect(isReplayable(OptedInReactor)).toBe(true);
    });

    it('marks methods without modifying the class or other methods', () => {
        expect(isOnceOnly(StandardReactor.prototype.eventForReplay)).toBe(true);
        expect(isOnceOnly(StandardReactor.prototype.replayEventForReplay)).toBe(false);
        expect(getReplayEventType(StandardReactor.prototype.replayEventForReplay)).toBe(true);
        expect(getReplayEventType(StandardReactor.prototype.rebuild)).toBe(EventForReplay);
    });
});
