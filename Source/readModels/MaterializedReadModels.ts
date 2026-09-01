// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { JsonSerializer } from '@cratis/fundamentals';
import { ChronicleConnection } from '../connection';
import { JsonSchemaGenerator } from '../schemas';
import { getReadModelMetadata } from './readModel';
import { ReadModelSubjectResolver } from './ReadModelSubjectResolver';
import type { IMaterializedReadModels } from './IMaterializedReadModels';

const defaultTake = 50;

/**
 * Implements {@link IMaterializedReadModels} by working with the Chronicle materialized read model gRPC service.
 */
export class MaterializedReadModels implements IMaterializedReadModels {
    constructor(
        private readonly _eventStore: string,
        private readonly _namespace: string,
        private readonly _connection: ChronicleConnection
    ) {}

    /** @inheritdoc */
    async getInstances<TReadModel>(readModelType: Constructor<TReadModel>, skip: number = 0, take: number = defaultTake): Promise<TReadModel[]> {
        const readModelIdentifier = this.resolveIdentifier(readModelType);
        const { page, pageSize, skipWithinPage } = this.toPageParams(skip, take);

        const response = await this._connection.materializedReadModels.getInstances({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModel: readModelIdentifier,
            Page: page,
            PageSize: pageSize
        });

        let instances = response.Instances.map(json => this.deserialize(readModelType, json));

        if (skipWithinPage > 0) {
            instances = instances.slice(skipWithinPage);
        }

        return this.releaseInstances(readModelType, instances);
    }

    /** @inheritdoc */
    async *observeInstances<TReadModel>(readModelType: Constructor<TReadModel>, skip: number = 0, take: number = defaultTake): AsyncIterable<TReadModel[]> {
        const readModelIdentifier = this.resolveIdentifier(readModelType);
        const { page, pageSize, skipWithinPage } = this.toPageParams(skip, take);

        for await (const response of this._connection.materializedReadModels.observeInstances({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            ReadModel: readModelIdentifier,
            Page: page,
            PageSize: pageSize
        })) {
            let instances = response.Instances.map(json => this.deserialize(readModelType, json));

            if (skipWithinPage > 0) {
                instances = instances.slice(skipWithinPage);
            }

            yield await this.releaseInstances(readModelType, instances);
        }
    }

    private resolveIdentifier<TReadModel>(readModelType: Constructor<TReadModel>): string {
        const metadata = getReadModelMetadata(readModelType);
        return metadata?.id.value ?? readModelType.name;
    }

    private toPageParams(skip: number, take: number): { page: number; pageSize: number; skipWithinPage: number } {
        if (take <= 0) {
            return { page: 0, pageSize: Number.MAX_SAFE_INTEGER, skipWithinPage: 0 };
        }

        const page = skip > 0 ? Math.floor(skip / take) : 0;
        const skipWithinPage = skip % take;

        return { page, pageSize: take, skipWithinPage };
    }

    private deserialize<TReadModel>(readModelType: Constructor<TReadModel>, json: string): TReadModel {
        if (!json) {
            return Object.create(readModelType.prototype) as TReadModel;
        }
        return JsonSerializer.deserialize(readModelType as Constructor<object>, json) as TReadModel;
    }

    private async releaseInstances<TReadModel>(readModelType: Constructor<TReadModel>, instances: TReadModel[]): Promise<TReadModel[]> {
        const schema = this.getSchema(readModelType);
        if (!this.schemaHasComplianceMetadata(schema)) {
            return instances;
        }

        return Promise.all(instances.map(instance => this.releaseInstance(readModelType, instance, schema)));
    }

    private async releaseInstance<TReadModel>(readModelType: Constructor<TReadModel>, instance: TReadModel, schema: string): Promise<TReadModel> {
        const subject = ReadModelSubjectResolver.resolveFrom(readModelType, instance);
        if (!subject) {
            return instance;
        }

        const payload = JsonSerializer.serialize(instance);
        const response = await this._connection.compliance.release({
            EventStore: this._eventStore,
            Namespace: this._namespace,
            Subject: subject,
            Schema: schema,
            Payload: payload
        });

        if (response.HasError) {
            return instance;
        }

        return this.deserialize(readModelType, response.Payload);
    }

    private getSchema<TReadModel>(readModelType: Constructor<TReadModel>): string {
        const metadata = getReadModelMetadata(readModelType);
        if (metadata) {
            return JSON.stringify(metadata.schema);
        }
        return JSON.stringify(JsonSchemaGenerator.generate(readModelType) ?? JsonSchemaGenerator.createEmptySchema(readModelType.name));
    }

    private schemaHasComplianceMetadata(schema: string): boolean {
        try {
            const parsed = JSON.parse(schema) as Record<string, unknown>;
            const properties = parsed.properties as Record<string, Record<string, unknown>> | undefined;
            if (!properties) {
                return false;
            }
            return Object.values(properties).some(
                property => Array.isArray(property.compliance) && (property.compliance as unknown[]).length > 0
            );
        } catch {
            return false;
        }
    }

}
