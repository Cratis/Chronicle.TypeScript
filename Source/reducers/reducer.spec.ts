// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { getReducerMetadata, reducer } from './reducer';

describe('reducer', () => {
    describe('when decorating a class without specifying isActive', () => {
        class SomeReducer {}
        reducer('some-reducer')(SomeReducer);

        it('should default isActive to true', () => {
            const metadata = getReducerMetadata(SomeReducer);

            expect(metadata?.isActive).toBe(true);
        });
    });

    describe('when decorating a class with isActive explicitly true', () => {
        class SomeActiveReducer {}
        reducer('some-active-reducer', undefined, undefined, true)(SomeActiveReducer);

        it('should set isActive to true', () => {
            const metadata = getReducerMetadata(SomeActiveReducer);

            expect(metadata?.isActive).toBe(true);
        });
    });

    describe('when decorating a class with isActive false', () => {
        class SomePassiveReducer {}
        reducer('some-passive-reducer', undefined, undefined, false)(SomePassiveReducer);

        it('should set isActive to false', () => {
            const metadata = getReducerMetadata(SomePassiveReducer);

            expect(metadata?.isActive).toBe(false);
        });
    });
});
