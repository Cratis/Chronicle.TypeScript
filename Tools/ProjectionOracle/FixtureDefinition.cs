// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelContracts;

using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Nodes;
using ContractEventType = KernelContracts::Cratis.Chronicle.Contracts.Events.EventType;
using ContractFrom = KernelContracts::Cratis.Chronicle.Contracts.Projections.FromDefinition;
using ContractJoin = KernelContracts::Cratis.Chronicle.Contracts.Projections.JoinDefinition;
using ContractRemoval = KernelContracts::Cratis.Chronicle.Contracts.Projections.RemovedWithDefinition;
using ContractDefinition = KernelContracts::Cratis.Chronicle.Contracts.Projections.ProjectionDefinition;
using ContractChildren = KernelContracts::Cratis.Chronicle.Contracts.Projections.ChildrenDefinition;
using ContractAll = KernelContracts::Cratis.Chronicle.Contracts.Projections.FromEveryDefinition;

namespace ProjectionOracle;

/// <summary>
/// Reads TypeScript's array-of-key/value wire dictionaries without inventing projection semantics.
/// </summary>
internal static class FixtureDefinition
{
    static readonly JsonSerializerOptions _strict = new() { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow };

    public static ContractDefinition Read(JsonObject node)
    {
        Only(node, "EventSequenceId", "Identifier", "ReadModel", "IsActive", "IsRewindable", "InitialModelState",
            "From", "Join", "Children", "FromEvery", "All", "FromEventProperty", "RemovedWith",
            "RemovedWithJoin", "Tags", "AutoMap", "Nested", "SubscribesToAllEvents", "NoAutoMapProperties", "LastUpdated");
        var definition = new ContractDefinition
        {
            EventSequenceId = node["EventSequenceId"]!.GetValue<string>(),
            Identifier = node["Identifier"]!.GetValue<string>(),
            ReadModel = node["ReadModel"]!.GetValue<string>(),
            IsActive = node["IsActive"]!.GetValue<bool>(),
            IsRewindable = node["IsRewindable"]!.GetValue<bool>(),
            InitialModelState = node["InitialModelState"]!.GetValue<string>(),
            SubscribesToAllEvents = node["SubscribesToAllEvents"]?.GetValue<bool>() ?? false,
            AutoMap = (KernelContracts::Cratis.Chronicle.Contracts.Projections.AutoMap)node["AutoMap"]!.GetValue<int>(),
            NoAutoMapProperties = node["NoAutoMapProperties"]!.AsArray().Select(item => item!.GetValue<string>()).ToList()
        };
        foreach (var entry in node["From"]!.AsArray())
        {
            Only(entry!.AsObject(), "Key", "Value");
            var key = entry["Key"]!.Deserialize<ContractEventType>(_strict)!;
            definition.From.Add(key, entry["Value"]!.Deserialize<ContractFrom>(_strict)!);
        }
        foreach (var entry in node["RemovedWith"]!.AsArray())
        {
            Only(entry!.AsObject(), "Key", "Value");
            var key = entry["Key"]!.Deserialize<ContractEventType>(_strict)!;
            definition.RemovedWith.Add(key, entry["Value"]!.Deserialize<ContractRemoval>(_strict)!);
        }
        foreach (var entry in node["Join"]!.AsArray())
        {
            Only(entry!.AsObject(), "Key", "Value");
            definition.Join.Add(entry["Key"]!.Deserialize<ContractEventType>(_strict)!, entry["Value"]!.Deserialize<ContractJoin>(_strict)!);
        }
        // Fail closed rather than silently discarding an unsupported wire operation.
        if (definition.From.Values.Any(from => !string.IsNullOrEmpty(from.ParentKey)) ||
            definition.RemovedWith.Values.Any(removal => !string.IsNullOrEmpty(removal.ParentKey)))
        {
            throw new NotSupportedException("Oracle fixtures support root-level projections only.");
        }
        if (node["Children"] is JsonObject children)
        {
            foreach (var (property, child) in children)
            {
                definition.Children.Add(property, ReadChildren(child!.AsObject()));
            }
        }
        foreach (var name in new[] { "FromEvery", "RemovedWithJoin", "Nested" })
        {
            if (node[name] is JsonArray array && array.Count != 0 || node[name] is JsonObject map && map.Count != 0)
            {
                throw new NotSupportedException($"Oracle fixture contains unsupported {name} operation.");
            }
        }
        if (node["All"] is JsonObject all)
        {
            Only(all, "Properties", "IncludeChildren", "AutoMap");
            definition.All = all.Deserialize<ContractAll>(_strict)!;
        }
        if (node["FromEventProperty"] is not null || node["LastUpdated"] is not null || node["Tags"] is JsonArray { Count: > 0 })
        {
            throw new NotSupportedException("Oracle fixture has unsupported FromEventProperty, LastUpdated or Tags operation.");
        }
        return definition;
    }

    /// <summary>
    /// Reads one level of children (From, Join and RemovedWith only); every other child operation fails closed.
    /// </summary>
    static ContractChildren ReadChildren(JsonObject node)
    {
        Only(node, "IdentifiedBy", "From", "Join", "Children", "All", "FromEventProperty", "RemovedWith",
            "RemovedWithJoin", "AutoMap", "Nested", "NoAutoMapProperties");
        var children = new ContractChildren
        {
            IdentifiedBy = node["IdentifiedBy"]!.GetValue<string>(),
            AutoMap = (KernelContracts::Cratis.Chronicle.Contracts.Projections.AutoMap)node["AutoMap"]!.GetValue<int>(),
            NoAutoMapProperties = node["NoAutoMapProperties"]?.AsArray().Select(item => item!.GetValue<string>()).ToList() ?? []
        };
        foreach (var entry in node["From"]!.AsArray())
        {
            Only(entry!.AsObject(), "Key", "Value");
            children.From.Add(entry["Key"]!.Deserialize<ContractEventType>(_strict)!, entry["Value"]!.Deserialize<ContractFrom>(_strict)!);
        }
        foreach (var entry in node["RemovedWith"]!.AsArray())
        {
            Only(entry!.AsObject(), "Key", "Value");
            children.RemovedWith.Add(entry["Key"]!.Deserialize<ContractEventType>(_strict)!, entry["Value"]!.Deserialize<ContractRemoval>(_strict)!);
        }
        foreach (var entry in node["Join"]!.AsArray())
        {
            Only(entry!.AsObject(), "Key", "Value");
            children.Join.Add(entry["Key"]!.Deserialize<ContractEventType>(_strict)!, entry["Value"]!.Deserialize<ContractJoin>(_strict)!);
        }
        foreach (var name in new[] { "Children", "RemovedWithJoin", "Nested" })
        {
            if (node[name] is JsonArray array && array.Count != 0 || node[name] is JsonObject map && map.Count != 0)
            {
                throw new NotSupportedException($"Oracle fixture contains unsupported child {name} operation.");
            }
        }
        if (node["All"] is JsonObject all && (all["Properties"] is JsonObject properties && properties.Count != 0 ||
            all["IncludeChildren"]?.GetValue<bool>() == true || all["AutoMap"]?.GetValue<int>() != 0) || node["FromEventProperty"] is not null)
        {
            throw new NotSupportedException("Oracle fixture has unsupported child All or FromEventProperty operation.");
        }
        return children;
    }

    static void Only(JsonObject node, params string[] fields)
    {
        foreach (var field in node.Select(entry => entry.Key))
        {
            if (!fields.Contains(field, StringComparer.Ordinal))
            {
                throw new InvalidOperationException($"Unknown fixture wire field '{field}'.");
            }
        }
    }
}
