// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { isStartAtTail, startAtTail } from './startAtTail.js';

@startAtTail()
class MarkedReactor {}

class OrdinaryReactor {}

class InheritedReactor extends MarkedReactor {}

describe('the start-at-tail decorator', () => {
    it('marks the reactor class', () => {
        expect(isStartAtTail(MarkedReactor)).toBe(true);
    });

    it('leaves an unmarked class alone', () => {
        expect(isStartAtTail(OrdinaryReactor)).toBe(false);
    });

    it('is not inherited by a subclass', () => {
        expect(isStartAtTail(InheritedReactor)).toBe(false);
    });

    it('refuses to decorate anything but a class', () => {
        const decorate = startAtTail() as unknown as (target: object, context: { kind: string }) => void;
        expect(() => decorate(() => {}, { kind: 'method' })).toThrow(TypeError);
    });
});
