#!/usr/bin/env python3

"""
Neural network simulation package with pattern matching capabilities.

This package provides a Python interface to the nsync neural network simulator,
including:
- NetworkSimulation class for running simulations
- SimulationResult class with pattern query capabilities  
- Fluent interface for defining complex event patterns
- Pattern matching and statistical analysis tools
"""

import numpy as np

# Import core simulation functionality
try:
    from .simulation import NetworkSimulation, SimulationResult
    from .patterns import EventPattern, PatternMatcher, PatternQueryBuilder, PatternMatch, create_pattern, apply_pattern, apply_pattern_to_multiple, analyze_pattern_across_results
except ImportError:
    # Handle direct execution of this module
    from simulation import NetworkSimulation, SimulationResult
    from patterns import EventPattern, PatternMatcher, PatternQueryBuilder, PatternMatch, create_pattern, apply_pattern, apply_pattern_to_multiple, analyze_pattern_across_results

# Convenience function for quick simulations
def run_quick_simulation(**kwargs) -> SimulationResult:
    """Run a simulation with default parameters.
    
    Args:
        **kwargs: Parameters to pass to run_simulation()
    
    Returns:
        SimulationResult object
    """
    sim = NetworkSimulation()
    return sim.run_simulation(**kwargs)

# Package exports
__all__ = [
    'NetworkSimulation',
    'SimulationResult', 
    'EventPattern',
    'PatternMatcher',
    'PatternQueryBuilder',
    'PatternMatch',
    'create_pattern',
    'apply_pattern',
    'apply_pattern_to_multiple',
    'analyze_pattern_across_results',
    'run_quick_simulation'
]

if __name__ == "__main__":
    # Example usage
    print("Running example network simulation...")
    
    # Create simulation instance
    sim = NetworkSimulation()
    
    # Run simulation with custom parameters and random initial voltages
    print("\n1. Simulation with random initial voltages:")
    result1 = sim.run_simulation(
        N=3,
        Tmax=50.0,
        strength=0.05,
        seed=42
    )
    
    print(f"Simulation completed!")
    print(f"- {len(result1.times)} time steps")
    print(f"- {len(result1.events)} events")
    print(f"- Voltage data shape: {result1.voltages.shape}")
    print(f"- Initial voltages: {result1.parameters['initial_voltages']}")
    print(f"- First few voltages: {result1.voltages[0]}")
    
    # Run simulation with specified initial voltages
    print("\n2. Simulation with specified initial voltages:")
    custom_voltages = [0.1, 0.5, 0.9]  # Different starting voltages for each neuron
    result2 = sim.run_simulation(
        N=3,
        Tmax=50.0,
        strength=0.05,
        seed=42,
        initial_voltages=custom_voltages
    )
    
    print(f"Simulation completed!")
    print(f"- {len(result2.times)} time steps")
    print(f"- {len(result2.events)} events")
    print(f"- Voltage data shape: {result2.voltages.shape}")
    print(f"- Initial voltages: {result2.parameters['initial_voltages']}")
    print(f"- First few voltages: {result2.voltages[0]}")
    
    # Get spike times for both simulations
    spikes1 = result1.get_spikes()
    spikes2 = result2.get_spikes()
    
    print(f"\nSpike times comparison:")
    print("Random initial voltages:")
    for neuron_id, spike_times in spikes1.items():
        print(f"  Neuron {neuron_id}: {len(spike_times)} spikes")
        if spike_times:
            print(f"    First spike: {spike_times[0]:.3f}")
    
    print("Custom initial voltages:")
    for neuron_id, spike_times in spikes2.items():
        print(f"  Neuron {neuron_id}: {len(spike_times)} spikes")
        if spike_times:
            print(f"    First spike: {spike_times[0]:.3f}")
    
    # Demonstrate new detailed event analysis
    print(f"\nDetailed event analysis for custom voltages simulation:")
    detailed_events = result2.get_detailed_events()
    print(f"- {len(detailed_events['spikes'])} spike events")
    print(f"- {len(detailed_events['natural_resets'])} natural reset events")
    print(f"- {len(detailed_events['spike_induced_resets'])} spike-induced reset events")
    
    # Show first few events of each type
    if detailed_events['spikes']:
        print(f"  First spike event: time {detailed_events['spikes'][0][0]:.3f}, neurons {detailed_events['spikes'][0][1]}")
    if detailed_events['spike_induced_resets']:
        print(f"  First spike-induced reset: time {detailed_events['spike_induced_resets'][0][0]:.3f}, neurons {detailed_events['spike_induced_resets'][0][1]}")
    
    # Demonstrate pattern matching system
    print(f"\n=== Event Pattern Matching Examples ===")
    
    # Example 1: Simple pattern with exact neuron specification
    print(f"\n1. Looking for spike -> spike_induced_reset pattern")
    pattern1 = result2.query_events().spike().any_neurons().spike_induced_reset().any_neurons().build()
    matches1 = result2.find_patterns(pattern1)
    print(f"   Found {len(matches1)} matches")
    
    # Example 2: Group-based permutation matching
    print(f"\n2. Group-based pattern: 2 neurons spike -> 1 neuron spike_induced_reset")
    pattern2 = result2.query_events().spike().groups(2).spike_induced_reset().groups(1).build()
    matches2 = result2.find_patterns(pattern2)
    print(f"   Found {len(matches2)} matches")
    
    # Example 3: Complex multi-step pattern with wildcards
    print(f"\n3. Complex pattern: spike -> anything -> reset")
    pattern3 = result2.query_events().spike().anything().reset().build()
    matches3 = result2.find_patterns(pattern3)
    print(f"   Found {len(matches3)} matches")
    
    # Example 4: Pattern statistics analysis
    if matches1:
        print(f"\n4. Pattern statistics for spike->spike_induced_reset:")
        stats = result2.analyze_pattern_statistics(pattern1)
        print(f"   Total occurrences: {stats['count']}")
        if stats['pattern_durations']:
            avg_duration = np.mean(stats['pattern_durations'])
            print(f"   Average pattern duration: {avg_duration:.6f}")
        if stats['inter_match_intervals']:
            avg_interval = np.mean(stats['inter_match_intervals'])
            print(f"   Average interval between patterns: {avg_interval:.6f}")
    
    # Example 5: Show detailed match information
    if matches1:
        print(f"\n5. Detailed match information for first pattern match:")
        match = matches1[0]
        print(f"   Match span: events {match['start_index']}-{match['end_index']}")
        print(f"   Time span: {match['start_time']:.6f} - {match['end_time']:.6f}")
        print(f"   Matched events:")
        for i, event in enumerate(match['matched_events']):
            print(f"     {i+1}. {event['type']} at t={event['time']:.6f}, neurons={event['neurons']}")
    
    print(f"\n=== Pattern Matching Usage Guide ===")
    print(f"""
# Basic Usage Examples:

# 1. Simple fluent interface
pattern = result.query_events().spike().exactly(1, 3).spike_induced_reset().exactly(0).build()

# 2. Permutation-invariant group matching  
pattern = result.query_events().spike().groups(2, 1).spike_induced_reset().groups(1).build()

# 3. References to previous steps
pattern = result.query_events().spike().exactly(1, 3).reset().same_as(0).build()

# 4. Wildcards and counting
pattern = result.query_events().spike().anything().reset().count(2).build()

# 5. Find matches
matches = result.find_patterns(pattern, start_time=50.0, end_time=100.0)

# 6. Analyze pattern statistics  
stats = result.analyze_pattern_statistics(pattern)
print(f"Pattern occurs {{stats['count']}} times")
""")