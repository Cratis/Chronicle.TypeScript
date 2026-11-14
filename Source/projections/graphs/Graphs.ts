// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { createLogger } from '../../logging/createLogger.js';
import { getReadModelMetadata } from '../../readModels/readModel.js';
import { hasFromEventMetadata } from '../modelBound/fromEvent.js';
import { registerProjectionWithRetry } from '../registerProjectionWithRetry.js';
import { GraphDeclaredMoreThanOnce } from './GraphDeclaredMoreThanOnce.js';
import { GraphDefinitionBuilder } from './GraphDefinitionBuilder.js';
import { GraphElementCannotBeReadModel } from './GraphElementCannotBeReadModel.js';
import type { GraphEdgeModel } from './GraphEdgeModel.js';
import type { GraphModel } from './GraphModel.js';
import type { GraphNodeModel } from './GraphNodeModel.js';
import { GraphProjectionBuilder } from './GraphProjectionBuilder.js';
import type { GraphRegistration } from './GraphRegistration.js';
import type { IGraphProjection } from './IGraphProjection.js';
import type { IGraphs } from './IGraphs.js';
import { getEdgeMetadata } from './edge.js';
import { getGraphProjectionMetadata } from './graphProjection.js';
import { getNodeMetadata } from './node.js';
import { ModelBoundGraphReader } from './ModelBoundGraphReader.js';
import type { GraphViewDefinition } from './views/GraphViewDefinition.js';
import { GraphViewDefinitionBuilder } from './views/GraphViewDefinitionBuilder.js';
import { getViewOfMetadata } from './views/viewOf.js';
import { ViewRootNotANode } from './views/ViewRootNotANode.js';

interface DeclaredGraph {
    readonly source: Constructor;
    readonly model: GraphModel;
    readonly projectionId: string;
}

/**
 * Implements {@link IGraphs}, discovering the graphs an application declares, with the decorators and with the fluent
 * builder, and registering them with the Chronicle Kernel.
 */
export class Graphs implements IGraphs {
    private readonly _failures = new Map<Constructor, Error>();
    private readonly _logger: ReturnType<typeof createLogger>;
    private _registrations: readonly GraphRegistration[] = [];
    private _viewDefinitions: readonly GraphViewDefinition[] = [];

    /**
     * Creates a new {@link Graphs} instance.
     * @param _eventStore - The event store name.
     * @param _connection - Chronicle connection.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     * @param _graphSinkTypeId - The identifier of the sink type that stores graphs.
     */
    constructor(
        private readonly _eventStore: string,
        private readonly _connection: ChronicleConnection,
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _graphSinkTypeId: string
    ) {
        this._logger = createLogger('@cratis/chronicle/graphs', _connection.logger);
    }

    /** @inheritdoc */
    get registrations(): readonly GraphRegistration[] {
        return this._registrations;
    }

    /** @inheritdoc */
    get viewDefinitions(): readonly GraphViewDefinition[] {
        return this._viewDefinitions;
    }

    /** @inheritdoc */
    get failures(): ReadonlyMap<Constructor, Error> {
        return this._failures;
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._failures.clear();
        const builder = new GraphDefinitionBuilder();
        const registrations: GraphRegistration[] = [];
        const names = new Set<string>();
        const models = new Map<string, GraphModel>();
        for (const declared of [...this.modelBoundGraphs(), ...this.fluentGraphs()]) {
            try {
                if (names.has(declared.model.name)) throw new GraphDeclaredMoreThanOnce(declared.model.name);
                registrations.push(builder.build(declared.model, declared.projectionId, this._graphSinkTypeId));
                names.add(declared.model.name);
                models.set(declared.model.name, declared.model);
            } catch (error) {
                this.fail(declared.source, error);
            }
        }

        this._registrations = registrations;
        this._viewDefinitions = this.discoverViews(models);
        this._logger.debug('Graph discovery complete', { graphCount: registrations.length, failureCount: this._failures.size });
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._registrations.length === 0) {
            this._logger.debug('No graphs to register');
            return;
        }

        this._logger.info('Registering graphs', { graphCount: this._registrations.length });
        await this._connection.readModels.registerMany({
            EventStore: this._eventStore,
            Owner: 1,
            ReadModels: this._registrations.map(registration => registration.readModel),
            Source: 1
        });

        for (const registration of this._registrations) {
            await registerProjectionWithRetry(
                this._connection, this._eventStore, this._logger, registration.projection, registration.projection.Identifier);
        }
    }

    private modelBoundGraphs(): DeclaredGraph[] {
        const reader = new ModelBoundGraphReader();
        const elements = new Map<string, { source: Constructor; nodes: GraphNodeModel[]; edges: GraphEdgeModel[] }>();
        const broken = new Set<string>();
        for (const type of this._clientArtifacts.graphElements ?? []) {
            this.tryRead(type, () => {
                const graph = ModelBoundGraphReader.graphNameOf(type);
                try {
                    if (hasFromEventMetadata(type) || getReadModelMetadata(type) !== undefined) throw new GraphElementCannotBeReadModel(type);
                    const declared = elements.get(graph) ?? { source: type, nodes: [], edges: [] };
                    elements.set(graph, declared);
                    if (getNodeMetadata(type)) declared.nodes.push(reader.readNode(type));
                    if (getEdgeMetadata(type)) declared.edges.push(reader.readEdge(type));
                } catch (error) {
                    // A graph without one of its nodes or edges is not what was declared. A replay would sweep away
                    // what the missing element left behind, so the whole graph is left unregistered.
                    broken.add(graph);
                    throw error;
                }
            });
        }

        return Array.from(elements)
            .filter(([name]) => !broken.has(name))
            .map(([name, declared]) => ({
                source: declared.source,
                model: { name, nodes: declared.nodes, edges: declared.edges },
                projectionId: name
            }));
    }

    private fluentGraphs(): DeclaredGraph[] {
        const result: DeclaredGraph[] = [];
        for (const type of this._clientArtifacts.graphProjections ?? []) {
            this.tryRead(type, () => {
                const name = getGraphProjectionMetadata(type)?.name ?? type.name;
                const projection = new type() as IGraphProjection;
                result.push({ source: type, model: new GraphProjectionBuilder().build(name, projection), projectionId: type.name });
            });
        }

        return result;
    }

    private discoverViews(models: ReadonlyMap<string, GraphModel>): GraphViewDefinition[] {
        const byGraph = new Map<string, Constructor[]>();
        for (const type of this._clientArtifacts.graphViews ?? []) {
            this.tryRead(type, () => {
                const graph = ModelBoundGraphReader.graphNameOf(type);
                byGraph.set(graph, [...(byGraph.get(graph) ?? []), type]);
            });
        }

        const builder = new GraphViewDefinitionBuilder();
        const definitions: GraphViewDefinition[] = [];
        for (const [graph, views] of byGraph) {
            const model = models.get(graph);
            if (model === undefined) {
                // The graph is not registered, so a view has nothing to read. Why is reported for the graph itself.
                for (const view of views) this.tryRead(view, () => { throw new ViewRootNotANode(view, graph, getViewOfMetadata(view)!.root()); });
                continue;
            }

            try {
                const result = builder.build(model, views);
                for (const [view, failure] of result.failures) this.fail(view, failure);
                if (result.definition !== undefined) definitions.push(result.definition);
            } catch (error) {
                for (const view of views) this.fail(view, error);
            }
        }

        return definitions;
    }

    private tryRead(type: Constructor, read: () => void): void {
        try {
            read();
        } catch (error) {
            this.fail(type, error);
        }
    }

    private fail(type: Constructor, error: unknown): void {
        const failure = error instanceof Error ? error : new Error(String(error));
        this._failures.set(type, failure);
        this._logger.error('Could not build a graph definition', { type: type.name, error: failure });
    }
}
