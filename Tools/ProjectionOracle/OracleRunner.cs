// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelConcepts;
extern alias KernelCore;
extern alias KernelInfrastructure;
extern alias KernelInMemory;

using System.Dynamic;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cratis.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Concepts = KernelConcepts::Cratis.Chronicle.Concepts;
using Engine = KernelCore::Cratis.Chronicle.Projections.Engine;
using Pipelines = KernelCore::Cratis.Chronicle.Projections.Engine.Pipelines;
using Compliance = KernelCore::Cratis.Chronicle.ReadModels.IReadModelsCompliance;
using Steps = KernelCore::Cratis.Chronicle.Projections.Engine.Pipelines.Steps;
using JsonSchema = KernelInfrastructure::Cratis.Chronicle.Schemas.JsonSchema;
using TypeFormats = KernelInfrastructure::Cratis.Chronicle.Schemas.TypeFormats;
using ExpandoObjectConverter = KernelInfrastructure::Cratis.Chronicle.Json.ExpandoObjectConverter;
using ObjectComparer = KernelInfrastructure::Cratis.Chronicle.Changes.ObjectComparer;
using SequenceStorage = KernelInMemory::Cratis.Chronicle.Storage.InMemory.EventSequences.EventSequenceStorage;
using IdentityStorage = KernelInMemory::Cratis.Chronicle.Storage.InMemory.Identities.IdentityStorage;
using InMemorySink = KernelInMemory::Cratis.Chronicle.Storage.InMemory.Sinks.InMemorySink;
using ChangesetStorage = KernelInMemory::Cratis.Chronicle.Storage.InMemory.Changes.ChangesetStorage;

namespace ProjectionOracle;

/// <summary>
/// Runs the packaged engine's complete production projection pipeline on fixture events.
/// </summary>
internal static class OracleRunner
{
    public static async Task<JsonArray> Run(JsonObject fixture)
    {
        var wire = FixtureDefinition.Read(fixture["wireDefinition"]!.AsObject());
        if (wire.EventSequenceId != Concepts.EventSequences.EventSequenceId.Log.Value)
        {
            throw new NotSupportedException("The oracle's in-memory event sequence only supports the event-log wire sequence.");
        }
        var definition = ProjectionDefinitionBridge.Convert(wire);
        var readModel = fixture["readModel"]!.AsObject();
        var readSchema = JsonSchema.FromJson(readModel["schema"]!.ToJsonString());
        var readModelDefinition = new Concepts.ReadModels.ReadModelDefinition(
            (Concepts.ReadModels.ReadModelIdentifier)wire.ReadModel,
            (Concepts.ReadModels.ReadModelContainerName)"ProjectionOracle",
            (Concepts.ReadModels.ReadModelDisplayName)"ProjectionOracle",
            Concepts.ReadModels.ReadModelOwner.Client,
            Concepts.ReadModels.ReadModelSource.User,
            Concepts.ReadModels.ReadModelObserverType.Projection,
            Concepts.ReadModels.ReadModelObserverIdentifier.Unspecified,
            new Concepts.Sinks.SinkDefinition(Concepts.Sinks.SinkConfigurationId.None, Concepts.Sinks.WellKnownSinkTypes.InMemory),
            new Dictionary<Concepts.ReadModels.ReadModelGeneration, JsonSchema> { [Concepts.ReadModels.ReadModelGeneration.First] = readSchema },
            []);

        var formats = new TypeFormats();
        var logger = NullLoggerFactory.Instance;
        var eventValues = new Engine.Expressions.EventValues.EventValueProviderExpressionResolvers(formats, logger.CreateLogger<Engine.Expressions.EventValues.EventValueProviderExpressionResolvers>());
        var keyResolvers = new Engine.KeyResolvers(logger.CreateLogger<Engine.KeyResolvers>());
        var propertyResolvers = new Engine.Expressions.ReadModelPropertyExpressionResolvers(eventValues, formats, logger.CreateLogger<Engine.Expressions.ReadModelPropertyExpressionResolvers>());
        var keyExpressions = new Engine.Expressions.Keys.KeyExpressionResolvers(eventValues, keyResolvers, logger.CreateLogger<Engine.Expressions.Keys.KeyExpressionResolvers>());
        var converter = new ExpandoObjectConverter(formats);
        var inputs = fixture["events"]!.AsArray();
        if (inputs.Count == 0)
        {
            throw new InvalidOperationException("Oracle fixture must contain at least one event.");
        }
        var firstContext = FixtureEventContext.Read(inputs[0]!["context"]!.AsObject());
        var eventStore = firstContext.EventStore;
        var @namespace = firstContext.Namespace;
        var identityStorage = new IdentityStorage();
        var eventSequence = new SequenceStorage(eventStore, @namespace, Concepts.EventSequences.EventSequenceId.Log, identityStorage);
        var factory = new Engine.ProjectionFactory(propertyResolvers, eventValues, keyExpressions, converter, keyResolvers, FactoryStorageProxy.For(eventSequence), logger.CreateLogger<Engine.ProjectionFactory>());
        var eventSchemas = fixture["eventSchemas"]!.AsArray().Select(node =>
        {
            Only(node!.AsObject(), "eventType", "schema");
            var type = node["eventType"]!.AsObject();
            return new Concepts.EventTypes.EventTypeSchema(
                ToEventType(type), Concepts.Events.EventTypeOwner.Client, Concepts.Events.EventTypeSource.Code,
                JsonSchema.FromJson(node["schema"]!.ToJsonString()));
        }).ToArray();
        var declaredTypes = wire.From.Keys.Concat(wire.RemovedWith.Keys).Select(type => (type.Id, type.Generation)).ToHashSet();
        var schemaTypes = eventSchemas.Select(schema => (schema.Type.Id.Value, schema.Type.Generation.Value)).ToHashSet();
        if (declaredTypes.Except(schemaTypes).Any() || schemaTypes.Count != eventSchemas.Length)
        {
            throw new InvalidOperationException("Fixture must provide exactly one schema for every declared event type.");
        }
        var projection = await factory.Create(eventStore, @namespace, definition, readModelDefinition, eventSchemas);

        using var sink = new InMemorySink(readModelDefinition, formats);
        var changesetStorage = new ChangesetStorage();
        var compliance = FactoryStorageProxy.Strict<Compliance>();
        var futures = FactoryStorageProxy.EmptyFutures();
        var replayCache = FactoryStorageProxy.Strict<Pipelines.IReplayScopedCache>();
        var comparer = new ObjectComparer();
        var tracker = new Pipelines.ProjectionFuturesTracker();
        Steps.ICanPerformProjectionPipelineStep[] steps =
        [
            new Steps.ResolveKey(eventSequence, sink, formats, logger.CreateLogger<Steps.ResolveKey>()),
            new Steps.SetInitialState(sink, logger.CreateLogger<Steps.SetInitialState>()),
            new Steps.DecryptInitialState(compliance, eventStore, @namespace),
            new Steps.HandleEvent(eventSequence, sink, logger.CreateLogger<Steps.HandleEvent>()),
            new Steps.EncryptChangeset(compliance, comparer, eventStore, @namespace),
            new Steps.StoreFutures(futures, tracker, logger.CreateLogger<Steps.StoreFutures>()),
            new Steps.ResolveFutures(futures, tracker, formats, comparer, logger.CreateLogger<Steps.ResolveFutures>()),
            new Steps.SaveChanges(sink, changesetStorage, true, logger.CreateLogger<Steps.SaveChanges>())
        ];
        var pipeline = new Pipelines.ProjectionPipeline(
            projection, sink, changesetStorage, comparer, steps, new Pipelines.ProjectionHandleLock(), replayCache,
            logger.CreateLogger<Pipelines.ProjectionPipeline>());
        var result = new JsonArray();
        ulong? lastSequenceNumber = null;
        for (var index = 0; index < inputs.Count; index++)
        {
            var input = inputs[index]!.AsObject();
            foreach (var field in input.Select(entry => entry.Key))
            {
                if (field is not ("context" or "content" or "expectedError"))
                {
                    throw new InvalidOperationException($"Unknown fixture event field '{field}'.");
                }
            }
            var context = FixtureEventContext.Read(input["context"]!.AsObject());
            if (lastSequenceNumber is not null && context.SequenceNumber.Value <= lastSequenceNumber)
            {
                throw new InvalidOperationException("Fixture events must be ordered by unique sequence number.");
            }
            lastSequenceNumber = context.SequenceNumber.Value;
            var eventSchema = eventSchemas.Single(schema => schema.Type == context.EventType).Schema;
            var content = converter.ToExpandoObject(input["content"]!.AsObject(), eventSchema);
            if (context.EventStore != eventStore || context.Namespace != @namespace)
            {
                throw new InvalidOperationException("All fixture events must belong to the same event store and namespace.");
            }
            // Append first, just as the kernel subscription receives already-stored events.
            var causedByChain = context.CausedBy == Concepts.Identities.Identity.NotSet
                ? []
                : await identityStorage.GetFor(context.CausedBy);
            var append = await eventSequence.Append(context.SequenceNumber, context.EventSourceType, context.EventSourceId,
                context.EventStreamType, context.EventStreamId, context.EventType, context.CorrelationId,
                context.Causation, causedByChain, context.Tags, context.Occurred,
                new Dictionary<Concepts.Events.EventTypeGeneration, ExpandoObject> { [context.EventType.Generation] = content },
                new Dictionary<Concepts.Events.EventTypeGeneration, Concepts.Events.EventHash> { [context.EventType.Generation] = context.Hash }, context.Subject);
            if (!append.IsSuccess)
            {
                throw new InvalidOperationException("Fixture event sequence rejected an append.");
            }
            var appended = eventSequence.Events[^1];
            JsonObject? error = null;
            try
            {
                if (projection.HasKeyResolverFor(context.EventType))
                {
                    var pipelineContext = await pipeline.Handle(appended);
                    if (pipelineContext.FailedPartitions.Any())
                    {
                        throw new InvalidOperationException("Sink reported failed partitions.");
                    }
                }
            }
            catch (Exception exception) when (input["expectedError"] is not null)
            {
                error = new JsonObject { ["type"] = exception.GetType().FullName, ["message"] = exception.Message };
            }
            if (input["expectedError"] is not null && index != inputs.Count - 1)
            {
                throw new InvalidOperationException("An expected error must be the last event; later sink state is undefined.");
            }
            var engineState = new JsonObject();
            var publicRead = new JsonObject();
            foreach (var (key, document) in sink.Collection.OrderBy(entry => entry.Key.ToString(), StringComparer.Ordinal))
            {
                var name = key.ToString()!;
                engineState[name] = JsonSerializer.SerializeToNode(document);
                publicRead[name] = converter.ToJsonObject(document, readSchema);
            }
            var snapshot = new JsonObject
            {
                ["sequenceNumber"] = context.SequenceNumber.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
                ["engineState"] = engineState,
                ["publicRead"] = publicRead
            };
            if (input["expectedError"] is JsonObject expectedError)
            {
                foreach (var field in expectedError.Select(entry => entry.Key))
                {
                    if (field is not ("type" or "message"))
                    {
                        throw new InvalidOperationException($"Unknown expected error field '{field}'.");
                    }
                }
                if (error is null || !JsonNode.DeepEquals(expectedError, error))
                {
                    throw new InvalidOperationException($"Expected error {expectedError.ToJsonString()}, got {error?.ToJsonString() ?? "no error"}.");
                }
                snapshot["error"] = error;
            }
            result.Add(snapshot);
        }
        return result;
    }

    static Concepts.Events.EventType ToEventType(JsonObject node)
    {
        Only(node, "Id", "Generation");
        return new(new Concepts.Events.EventTypeId(node["Id"]!.GetValue<string>()),
            new Concepts.Events.EventTypeGeneration(node["Generation"]!.GetValue<uint>()));
    }

    static void Only(JsonObject node, params string[] fields)
    {
        foreach (var field in node.Select(entry => entry.Key))
        {
            if (!fields.Contains(field, StringComparer.Ordinal))
            {
                throw new InvalidOperationException($"Unknown fixture event schema field '{field}'.");
            }
        }
    }
}
