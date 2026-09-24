// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { Identity, IdentityProvider } from '../identity/index.js';
import { CorrelationId, CorrelationIdManager } from '../correlation/index.js';
import { CausationManager } from './CausationManager.js';
import { CausationType } from './CausationType.js';

describe('when concurrently running nested ambient contexts', () => {
    it('should keep each request isolated and restore its parent across awaits', async () => {
        const identities = new IdentityProvider();
        const correlations = new CorrelationIdManager();
        const causations = new CausationManager();
        const principal = (name: string) => new Identity(name, name);
        const correlation = (name: string) => new CorrelationId(name);
        const link = new CausationType('Command');
        const run = (name: string) => identities.run(principal(name), () =>
            correlations.run(correlation(name), () => causations.run(link, { name }, async () => {
                await Promise.resolve();
                expect(identities.getCurrent().subject).toBe(name);
                expect(correlations.current.value).toBe(name);
                expect(causations.getCurrentChain().at(-1)?.properties.name).toBe(name);
                await identities.run(principal(`${name}-nested`), () =>
                    correlations.run(correlation(`${name}-nested`), () =>
                        causations.run(link, { name: `${name}-nested` }, async () => {
                            await Promise.resolve();
                            expect(identities.getCurrent().subject).toBe(`${name}-nested`);
                            expect(correlations.current.value).toBe(`${name}-nested`);
                            expect(causations.getCurrentChain()).toHaveLength(3);
                        })));
                expect(identities.getCurrent().subject).toBe(name);
                expect(correlations.current.value).toBe(name);
                expect(causations.getCurrentChain()).toHaveLength(2);
            })));

        await Promise.all([run('a'), run('b')]);
        expect(identities.getCurrent()).toBe(Identity.system);
        expect(causations.getCurrentChain()).toHaveLength(1);
    });

    it('should not accumulate append links between sibling scoped operations', () => {
        const causations = new CausationManager();
        causations.run(link(), { name: 'command' }, () => {
            causations.run(link(), { name: 'append-one' }, () => {
                expect(causations.getCurrentChain()).toHaveLength(3);
            });
            causations.run(link(), { name: 'append-two' }, () => {
                expect(causations.getCurrentChain()).toHaveLength(3);
            });
            expect(causations.getCurrentChain()).toHaveLength(2);
        });
        expect(causations.getCurrentChain()).toHaveLength(1);
    });
});

function link(): CausationType { return new CausationType('Command'); }
