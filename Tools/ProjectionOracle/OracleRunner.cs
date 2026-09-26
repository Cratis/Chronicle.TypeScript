// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelConcepts;
extern alias KernelCore;
extern alias KernelInfrastructure;
extern alias KernelInMemory;

using System.Dynamic;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cratis.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Concepts = KernelConcepts::Cratis.Chronicle.Concepts;
using Engine = KernelCore::Cratis.Chronicle.Projections.Engine;
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

/// <summary>Runs the packaged engine's production resolve, initialize, handle and save steps on fixture events.</summary>
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
        var eventSequence = new SequenceStorage(Concepts.EventStoreName.NotSet, Concepts.EventStoreNamespaceName.NotSet, Concepts.EventSequences.EventSequenceId.Log, new IdentityStorage());
        var factory = new Engine.ProjectionFactory(propertyResolvers, eventValues, keyExpressions, converter, keyResolvers, FactoryStorageProxy.For(eventSequence), logger.CreateLogger<Engine.ProjectionFactory>());
        var eventSchemas = fixture["eventSchemas"]!.AsArray().Select(node =>
        {
            var type = node!["eventType"]!.AsObject();
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
        var projection = await factory.Create(Concepts.EventStoreName.NotSet, Concepts.EventStoreNamespaceName.NotSet, definition, readModelDefinition, eventSchemas);

        using var sink = new InMemorySink(readModelDefinition, formats);
        var changesetStorage = new ChangesetStorage();
        Steps.ICanPerformProjectionPipelineStep[] steps =
        [
            new Steps.ResolveKey(eventSequence, sink, formats, logger.CreateLogger<Steps.ResolveKey>()),
            new Steps.SetInitialState(sink, logger.CreateLogger<Steps.SetInitialState>()),
            new Steps.HandleEvent(eventSequence, sink, logger.CreateLogger<Steps.HandleEvent>()),
            new Steps.SaveChanges(sink, changesetStorage, false, logger.CreateLogger<Steps.SaveChanges>())
        ];
        var result = new JsonArray();
        var comparer = new ObjectComparer();
        ulong? lastSequenceNumber = null;
        foreach (var eventNode in fixture["events"]!.AsArray())
        {
            var input = eventNode!.AsObject();
            var context = input["context"]!.AsObject();
            var type = ToEventType(context["eventType"]!.AsObject());
            var sequenceNumber = ulong.Parse(context["sequenceNumber"]!.GetValue<string>(), CultureInfo.InvariantCulture);
            if (lastSequenceNumber is not null && sequenceNumber <= lastSequenceNumber) throw new InvalidOperationException("Fixture events must be ordered by unique sequence number.");
            lastSequenceNumber = sequenceNumber;
            var eventSchema = eventSchemas.Single(schema => schema.Type == type).Schema;
            var content = converter.ToExpandoObject(input["content"]!.AsObject(), eventSchema);
            var kernelContext = Concepts.Events.EventContext.Empty with
            {
                EventType = type,
                EventSourceId = (Concepts.Events.EventSourceId)context["eventSourceId"]!.GetValue<string>(),
                SequenceNumber = (Concepts.Events.EventSequenceNumber)sequenceNumber,
                Occurred = DateTimeOffset.Parse(context["occurred"]!.GetValue<string>(), CultureInfo.InvariantCulture)
            };
            var appended = new Concepts.Events.AppendedEvent(kernelContext, content);
            if (projection.HasKeyResolverFor(type))
            {
                var pipelineContext = Engine.ProjectionEventContext.Empty(comparer, appended) with { OperationType = projection.GetOperationTypeFor(type) };
                foreach (var step in steps)
                {
                    pipelineContext = await step.Perform(projection, pipelineContext);
                }
                if (pipelineContext.FailedPartitions.Any()) throw new InvalidOperationException("Sink reported failed partitions.");
            }
            var engineState = new JsonObject();
            var publicRead = new JsonObject();
            foreach (var (key, document) in sink.Collection.OrderBy(entry => entry.Key.ToString(), StringComparer.Ordinal))
            {
                var name = key.ToString()!;
                engineState[name] = JsonSerializer.SerializeToNode(document);
                publicRead[name] = converter.ToJsonObject(document, readSchema);
            }
            result.Add(new JsonObject
            {
                ["sequenceNumber"] = context["sequenceNumber"]!.GetValue<string>(),
                ["engineState"] = engineState,
                ["publicRead"] = publicRead
            });
        }
        return result;
    }

    static Concepts.Events.EventType ToEventType(JsonObject node) => new(
        new Concepts.Events.EventTypeId(node["Id"]!.GetValue<string>()),
        new Concepts.Events.EventTypeGeneration(node["Generation"]!.GetValue<uint>()));
}
