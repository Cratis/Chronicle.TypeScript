// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { JsonSerializer } from '@cratis/fundamentals';
import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getFromEventMetadata } from '../projections/modelBound/fromEvent.js';
import { getRemovedWithClassMetadata } from '../projections/modelBound/removedWith.js';
import { getRemovedWithJoinClassMetadata } from '../projections/modelBound/removedWithJoin.js';
import { getClearWithClassMetadata } from '../projections/modelBound/clearWith.js';
import { getVariantOfMetadata } from '../projections/modelBound/variantOf.js';
import { getEntersOnMetadata } from '../projections/modelBound/entersOn.js';
import { getProjectionMetadata } from '../projections/declarative/projection.js';
import { getReducerMetadata } from '../reducers/reducer.js';
import { DecoratorType } from '../types/DecoratorType.js';
import { hasModelBoundProperties, TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { ReadModelScenarioGivenBuilder } from './ReadModelScenarioGivenBuilder.js';
import type { IReadModelProcessor } from './IReadModelProcessor.js';
import type { ReadModelState } from './ReadModelState.js';
import { ReducerReadModelProcessor } from './ReducerReadModelProcessor.js';
import type { ScenarioEvent } from './ScenarioEvent.js';

type ScenarioArtifacts = Pick<IClientArtifactsProvider, 'reducers' | 'eventTypes' | 'projections'>;

/**
 * Folds seeded events through a reducer in-process, without a Chronicle kernel.
 * Projections, observer scheduling, storage, migrations, and compliance are not simulated.
 * Supply an artifact catalog to isolate a scenario from process-wide decorator discovery.
 */
export class ReadModelScenario<TReadModel extends object> {
    private readonly _processor: IReadModelProcessor<TReadModel>;
    private readonly _events: ScenarioEvent[] = [];
    private _results: Promise<Map<string, ReadModelState<TReadModel>>> | undefined;

    /** Selects the reducer associated with the read model type. */
    constructor(readModelType: Constructor<TReadModel>, artifacts?: ScenarioArtifacts) {
        const registered = artifacts ?? {
            reducers: TypeDiscoverer.default.getTypesByDecoratorType(DecoratorType.Reducer),
            eventTypes: TypeDiscoverer.default.getTypesByDecoratorType(DecoratorType.EventType),
            projections: TypeDiscoverer.default.getTypesByDecoratorType(DecoratorType.Projection)
        };
        const reducerTypes = registered.reducers.filter(type => getReducerMetadata(type)?.readModel === readModelType);
        if (reducerTypes.length > 1) {
            throw new Error(`Multiple reducers found for read model '${readModelType.name}'.`);
        }
        if (reducerTypes.length === 0) {
            const projected = getFromEventMetadata(readModelType).length > 0 || hasModelBoundProperties(readModelType) ||
                getRemovedWithClassMetadata(readModelType).length > 0 || getRemovedWithJoinClassMetadata(readModelType).length > 0 ||
                getClearWithClassMetadata(readModelType).length > 0 || getVariantOfMetadata(readModelType) !== undefined ||
                getEntersOnMetadata(readModelType).length > 0 ||
                registered.projections.some(type => getProjectionMetadata(type)?.readModelType === readModelType);
            if (projected) {
                throw new Error(`Projection-backed read model '${readModelType.name}' is not supported yet; use a kernel-backed test.`);
            }
            throw new Error(`No reducer found for read model '${readModelType.name}'. Pass the read model type to @reducer; projections are not supported yet (use a kernel-backed test).`);
        }
        this._processor = new ReducerReadModelProcessor(readModelType, reducerTypes[0], registered.eventTypes);
    }

    /** Fluent entry point for event history. */
    get given(): ReadModelScenarioGivenBuilder<TReadModel> {
        return new ReadModelScenarioGivenBuilder(this);
    }

    /** Returns the sole materialized model, or null when no model exists. */
    get instance(): Promise<TReadModel | null> {
        return this.process().then(results => {
            const materialized = [...results.values()].filter(result => result.instance !== null);
            if (materialized.length > 1) {
                throw new Error('Multiple read model instances materialized; use instanceForEventSourceId(id).');
            }
            return materialized[0]?.instance ?? null;
        });
    }

    /** Returns the model for one source, or null if no handler created it or it was deleted. */
    async instanceForEventSourceId(id: string): Promise<TReadModel | null> {
        return (await this.process()).get(id)?.instance ?? null;
    }

    /** Distinguishes a model removed by a reducer from one never created. */
    async wasDeletedForEventSourceId(id: string): Promise<boolean> {
        return (await this.process()).get(id)?.deleted ?? false;
    }

    /** Collects events for a source; subsequent reads replay the complete seeded history. */
    collectEventsFor(id: string, events: readonly object[]): void {
        for (const event of events) {
            const metadata = getEventTypeMetadata(event.constructor);
            if (!metadata) throw new Error(`Event '${event.constructor.name}' has no @eventType metadata.`);
            // The kernel delivers JSON objects, not instances of decorated event classes.
            const content: unknown = JSON.parse(JsonSerializer.serialize(event));
            this._events.push({
                sourceId: id,
                content,
                context: {
                    eventSourceId: id,
                    eventSourceType: 'Default',
                    eventStreamType: 'All',
                    eventStreamId: 'Default',
                    eventStore: '[NotSet]',
                    namespace: '[NotSet]',
                    sequenceNumber: BigInt(this._events.length),
                    eventType: metadata.eventType,
                    occurred: new Date(),
                    correlationId: '00000000-0000-0000-0000-000000000000',
                    causation: [],
                    tags: []
                }
            });
        }
        this._results = undefined;
    }

    private process(): Promise<Map<string, ReadModelState<TReadModel>>> {
        if (!this._results) {
            const events = [...this._events];
            this._results = this._processor.process(events);
        }
        return this._results;
    }
}
