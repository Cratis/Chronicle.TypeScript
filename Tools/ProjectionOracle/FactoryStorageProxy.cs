// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelConcepts;
extern alias KernelCore;
extern alias KernelStorage;
extern alias KernelInMemory;

using System.Reflection;
using IStorage = KernelStorage::Cratis.Chronicle.Storage.IStorage;
using IProjectionFutures = KernelCore::Cratis.Chronicle.Projections.IProjectionFutures;
using ProjectionFuture = KernelConcepts::Cratis.Chronicle.Concepts.Projections.ProjectionFuture;
using IEventStoreStorage = KernelStorage::Cratis.Chronicle.Storage.IEventStoreStorage;
using IEventStoreNamespaceStorage = KernelStorage::Cratis.Chronicle.Storage.IEventStoreNamespaceStorage;
using IEventSequenceStorage = KernelStorage::Cratis.Chronicle.Storage.EventSequences.IEventSequenceStorage;

namespace ProjectionOracle;

/// <summary>
/// Only supplies the three storage lookups ProjectionFactory uses for flat definitions.
/// </summary>
public class FactoryStorageProxy : DispatchProxy
{
    Func<MethodInfo, object?> _dispatch = null!;

    /// <summary>
    /// Creates a strict, in-memory event-sequence lookup for the production projection factory.
    /// </summary>
    public static IStorage For(IEventSequenceStorage events)
    {
        var ns = Create<IEventStoreNamespaceStorage>(method => method.Name == "GetEventSequence"
            ? events : throw new NotSupportedException($"ProjectionFactory called {method.DeclaringType?.Name}.{method.Name}"));
        var store = Create<IEventStoreStorage>(method => method.Name == "GetNamespace"
            ? ns : throw new NotSupportedException($"ProjectionFactory called {method.DeclaringType?.Name}.{method.Name}"));
        return Create<IStorage>(method => method.Name == "GetEventStore"
            ? store : throw new NotSupportedException($"ProjectionFactory called {method.DeclaringType?.Name}.{method.Name}"));
    }

    /// <summary>
    /// Creates a dependency that fails if a fixture invokes an unsupported production path.
    /// </summary>
    public static T Strict<T>() where T : class => Create<T>(method =>
        throw new NotSupportedException($"Oracle fixture called {method.DeclaringType?.Name}.{method.Name}"));

    /// <summary>
    /// Returns no futures for the production pipeline's initial durable-store probe.
    /// Any attempt to add or resolve a future fails closed.
    /// </summary>
    public static IProjectionFutures EmptyFutures()
    {
        var probed = false;
        return Create<IProjectionFutures>(method =>
        {
            if (method.Name == nameof(IProjectionFutures.GetFutures) && !probed)
            {
                probed = true;
                return Task.FromResult<IEnumerable<ProjectionFuture>>([]);
            }
            throw new NotSupportedException($"Oracle fixture called {method.DeclaringType?.Name}.{method.Name}");
        });
    }

    static T Create<T>(Func<MethodInfo, object?> dispatch) where T : class
    {
        var proxy = DispatchProxy.Create<T, FactoryStorageProxy>();
        ((FactoryStorageProxy)(object)proxy)._dispatch = dispatch;
        return proxy;
    }

    /// <inheritdoc/>
    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) =>
        _dispatch(targetMethod ?? throw new InvalidOperationException("Missing proxy method."));
}
