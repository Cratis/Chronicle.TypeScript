// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, type Assertion } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import { EventScenario } from '../../index.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

/**
 * Proves a numeric unique constraint applicable to the event log is not rejected as non-isolated because another
 * constraint is scoped only to a different event sequence.
 * @param claimed - Event type constructor with a numeric key.
 * @param other - Event type constructor used by the outbox-only constraint.
 * @param constraints - The numeric event log constraint and the outbox-only constraint.
 */
export function otherSequenceExtendedKeyBehaviors(
    claimed: new () => object,
    other: new () => object,
    constraints: Constructor[]
): void {
    describe('with a numeric key and a constraint scoped to another event sequence', () => {
        const create = () => new EventScenario({ artifacts: { eventTypes: [claimed, other], constraints } });

        it('should construct the scenario', () => {
            should(create).not.throw();
        });

        it('should accept the first event', async () => {
            should((await create().append('A', new claimed())).isSuccess).equal(true);
        });

        it('should enforce the numeric constraint on the event log', async () => {
            const scenario = create();
            await scenario.append('A', new claimed());
            should((await scenario.append('B', new claimed())).isSuccess).equal(false);
        });
    });
}
