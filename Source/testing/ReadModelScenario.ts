// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { JsonSerializer } from '@cratis/fundamentals';
import type { Constructor } from '@cratis/fundamentals';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getFromEventMetadata } from '../projections/modelBound/fromEvent.js';
import { getRemovedWithClassMetadata } from '../projections/modelBound/removedWith.js';
import { getRemovedWithJoinClassMetadata } from '../projections/modelBound/removedWithJoin.js';
import { getClearWithClassMetadata } from '../projections/modelBound/clearWith.js';
import { getVariantOfMetadata } from '../projections/modelBound/variantOf.js';
import { getEntersOnMetadata } from '../projections/modelBound/entersOn.js';
import { getProjectionMetadata } from '../projections/declarative/projection.js';
import { ProjectionDefinitionCompiler } from '../projections/ProjectionDefinitionCompiler.js';
import { getReadModelId } from '../readModels/readModel.js';
import { getReducerMetadata } from '../reducers/reducer.js';
import { hasModelBoundProperties, TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { ReadModelScenarioGivenBuilder } from './ReadModelScenarioGivenBuilder.js';
import type { IReadModelProcessor } from './IReadModelProcessor.js';
import type { ReadModelState } from './ReadModelState.js';
import { ReducerReadModelProcessor } from './ReducerReadModelProcessor.js';
import type { ScenarioEvent } from './ScenarioEvent.js';
import { ProjectionReadModelProcessor } from './projections/ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from './projections/UnsupportedProjectionOperation.js';

type ScenarioArtifacts = Pick<IClientArtifactsProvider, 'reducers' | 'eventTypes' | 'projections'> &
    Partial<Pick<IClientArtifactsProvider, 'readModels' | 'globalForHandlers'>>;

/**
 * Folds seeded events through a reducer or a validated flat projection, without a Chronicle kernel.
 * Observer scheduling, storage, migrations, and compliance are not simulated.
 * Supply an artifact catalog to isolate a scenario from process-wide decorator discovery.
 */
export class ReadModelScenario<TReadModel extends object> {
    private readonly _processor: IReadModelProcessor<TReadModel>;
    private readonly _modelName: string;
    private readonly _events: ScenarioEvent[] = [];
    private _results: Promise<Map<string, ReadModelState<TReadModel>>> | undefined;

    /** Selects the reducer (when present) or a single applicable compiled projection. */
    constructor(readModelType: Constructor<TReadModel>, artifacts?: ScenarioArtifacts) {
        this._modelName = readModelType.name;
        const registered = artifacts ?? new DefaultClientArtifactsProvider(TypeDiscoverer.default);
        const reducerTypes = registered.reducers.filter(type => getReducerMetadata(type)?.readModel === readModelType);
        if (reducerTypes.length > 1) {
            throw new Error(`Multiple reducers found for read model '${readModelType.name}'.`);
        }
        if (reducerTypes.length) {
            this._processor = new ReducerReadModelProcessor(readModelType, reducerTypes[0], registered.eventTypes);
            return;
        }
        const modelBound = getFromEventMetadata(readModelType).length > 0 || hasModelBoundProperties(readModelType) ||
            getRemovedWithClassMetadata(readModelType).length > 0 || getRemovedWithJoinClassMetadata(readModelType).length > 0 ||
            getClearWithClassMetadata(readModelType).length > 0 || getVariantOfMetadata(readModelType) !== undefined ||
            getEntersOnMetadata(readModelType).length > 0;
        // Definitions without a declared model can be associated by the registration compiler's
        // unambiguous schema inference; never guess their association from decorators here.
        const declarative = registered.projections.filter(type => {
            const metadata = getProjectionMetadata(type);
            return metadata !== undefined && (metadata.readModelType === readModelType ||
                (metadata.readModelType === undefined && registered.readModels?.includes(readModelType)));
        });
        if (Number(modelBound) + declarative.filter(type => getProjectionMetadata(type)?.readModelType === readModelType).length > 1) {
            throw new Error(`Multiple projections found for read model '${readModelType.name}'.`);
        }
        if (!modelBound && !declarative.length) {
            throw new Error(`No reducer or projection found for read model '${readModelType.name}'.`);
        }
        const catalog: IClientArtifactsProvider = {
            eventTypes: registered.eventTypes, reducers: registered.reducers, projections: declarative,
            readModels: [...new Set([...(registered.readModels ?? []), readModelType])],
            globalForHandlers: artifacts?.globalForHandlers ?? [], reactors: [], seeders: [], constraints: [],
            webhooks: [], eventTypeMigrations: []
        };
        const compiled = new ProjectionDefinitionCompiler(catalog, 'scenario').compile(declarative, modelBound ? [readModelType] : []);
        const definitions = compiled.definitions.filter(definition => definition.ReadModel === getReadModelId(readModelType));
        if (definitions.length !== 1) {
            throw new Error(`Expected one projection for read model '${readModelType.name}', found ${definitions.length}.`);
        }
        this._processor = new ProjectionReadModelProcessor(readModelType, compiled, definitions[0]);
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
            this._results = this._processor.process(events).catch(error => {
                if (!(this._processor instanceof ProjectionReadModelProcessor) || error instanceof UnsupportedProjectionOperation) throw error;
                throw new Error(`Projection replay for read model '${this._modelName}' failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
            });
        }
        return this._results;
    }
}
