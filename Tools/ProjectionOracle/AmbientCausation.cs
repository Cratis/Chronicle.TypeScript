// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections;
using System.Reflection;
using Cratis.Chronicle.Auditing;

namespace ProjectionOracle;

/// <summary>
/// Reads and writes the .NET client's ambient causation chain. The packaged client keeps it in a private
/// <c>AsyncLocal</c> of wrapper entries (one per causation), so the oracle goes through reflection.
/// </summary>
sealed class AmbientCausation
{
    readonly object _asyncLocal;
    readonly PropertyInfo _value;
    readonly Type _entryType;

    AmbientCausation(object asyncLocal)
    {
        _asyncLocal = asyncLocal;
        _value = asyncLocal.GetType().GetProperty("Value")!;
        _entryType = asyncLocal.GetType().GetGenericArguments()[0].GetGenericArguments()[0];
    }

    public static AmbientCausation Open() => new(typeof(CausationManager)
        .GetField("_current", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!);

    public List<Causation> Value
    {
        get => ((IEnumerable?)_value.GetValue(_asyncLocal))?.Cast<object>()
            .Select(entry => (Causation)_entryType.GetProperty("Causation")!.GetValue(entry)!).ToList() ?? [];
        set
        {
            var list = (IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(_entryType))!;
            foreach (var causation in value)
            {
                list.Add(Activator.CreateInstance(_entryType, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic, null, [causation], null)!);
            }
            _value.SetValue(_asyncLocal, list);
        }
    }
}
