// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { onceOnly, isOnceOnly } from './onceOnly.js';
import { replay, getReplayEventType } from './replay.js';

class EventForReplay {}

@onceOnly()
class StandardReactor {
    @onceOnly()
    eventForReplay() {}

    @replay()
    replayEventForReplay() {}

    @replay(EventForReplay)
    rebuild() {}
}

class OrdinaryReactor {}

class InheritedReactor extends StandardReactor {}

describe('standard reactor policy decorators', () => {
    it('marks the class independently of its handlers', () => {
        expect(isOnceOnly(StandardReactor)).toBe(true);
        expect(isOnceOnly(OrdinaryReactor)).toBe(false);
        expect(isOnceOnly(InheritedReactor)).toBe(false);
    });

    it('marks methods without modifying the class or other methods', () => {
        expect(isOnceOnly(StandardReactor.prototype.eventForReplay)).toBe(true);
        expect(isOnceOnly(StandardReactor.prototype.replayEventForReplay)).toBe(false);
        expect(getReplayEventType(StandardReactor.prototype.replayEventForReplay)).toBe(true);
        expect(getReplayEventType(StandardReactor.prototype.rebuild)).toBe(EventForReplay);
    });
});
