# nsync - Neural Network Simulator with Pattern Matching

A Python package for simulating pulse-coupled neural networks with delay, featuring a powerful fluent interface for pattern matching and event analysis.

## Overview

This package implements a C & Python based simulator for pulse-coupled neural networks with delay as introduced in:

> U. Ernst, K. Pawelzik, and T. Geisel. Synchronization induced by temporal
> delays in pulse-coupled oscillators. Phys. Rev. Lett., 74, 1995.
> http://www.nld.ds.mpg.de/downloads/publications/p1570_1.pdf

The algorithm is based on numerically exact integration as presented in:

> Rotter S and Diesmann M. Exact Digital Simulation of Time-Invariant Linear Systems
> with Applications to Neuronal Modeling. Biological Cybernetics 81:381-402 (1999)

## Installation

### Prerequisites

- Python 3.8+
- GCC compiler
- uv (recommended) or pip

### Install with for python development

```bash
git clone <repository-url>
cd nsync
uv sync          # recommended for python development
pip install -e . # alternative to uv sync
```

## Python Usage Examples

```python
from nsync import NetworkSimulation, run_quick_simulation

# Run simulation
result = sim.run_simulation(
    N=5,                    # Number of neurons
    Tmax=100.0,            # Simulation time
    strength=0.025,        # Coupling strength (positive=excitatory, negative=inhibitory)
    delay=1.59,            # Spike transmission delay
    I=1.04,                # Base driving current
    Ijitter=0.1,           # Current variation between neurons
    seed=42,               # Random seed for reproducibility
    initial_phases=[0.1, 0.3, 0.5, 0.7, 0.9]  # Optional: specify starting phases
)

# Access simulation data
print(f"Simulation completed with {len(result.events)} events")
print(f"Phase data shape: {result.phases.shape}")  # (timesteps, neurons)
print(f"Simulation parameters: {result.parameters}")
print(f"Time points: {len(result.times)}")
print(f"Phase evolution: {result.phases.shape}")
print(f"Events recorded: {len(result.events)}")
```

### Pattern Matching

The pattern matching system allows you to define and search for complex event sequences with a fluent interface.

#### Basic Pattern Matching

```python
# Search for spike -> spike-induced reset interaction patterns
pattern = result.query_events().spike().any_neurons().spike_induced_reset().any_neurons().build()
matches = result.find_patterns(pattern)

print(f"Found {len(matches)} interaction patterns")

# Examine first match
if matches:
    match = matches[0]
    print(f"Pattern found at time {match['start_time']:.3f}-{match['end_time']:.3f}")
    for i, event in enumerate(match['matched_events']):
        print(f"  {i+1}. {event['type']} at t={event['time']:.3f}, neurons={event['neurons']}")
```

#### Permutation-Invariant Group Matching

This is the most powerful feature for analyzing synchronization patterns where neuron identity doesn't matter, only the group structure.

```python
# Look for patterns based on group sizes (permutation-invariant)
pattern = (result.query_events()
    .spike().groups(2)               # Any 2 neurons spike together
    .spike_induced_reset().groups(1) # Any 1 neuron gets reset
    .spike().groups(2)               # Any 2 neurons spike again
    .build())

matches = result.find_patterns(pattern)
print(f"Found {len(matches)} group-based synchronization patterns")

# For exact neuron specification instead:
exact_pattern = (result.query_events()
    .spike().exactly(1, 3)           # Specific neurons 1 and 3
    .spike_induced_reset().exactly(0) # Specific neuron 0
    .build())
```

#### Standalone Pattern Creation and Multi-Result Analysis

The pattern system supports creating patterns independently of simulation results and applying them to one or multiple results. This is powerful for comparative analysis across different parameter regimes.

```python
from nsync import create_pattern, apply_pattern, apply_pattern_to_multiple, analyze_pattern_across_results

# Create multiple simulation results with different parameters
sim = NetworkSimulation()
weak_coupling = sim.run_simulation(N=4, Tmax=50.0, strength=0.01, seed=42)
strong_coupling = sim.run_simulation(N=4, Tmax=50.0, strength=0.1, seed=42)
different_delay = sim.run_simulation(N=4, Tmax=50.0, delay=3.0, seed=42)

# Create pattern independent of any result
interaction_pattern = (create_pattern()
    .spike().groups(2)
    .spike_induced_reset().groups(1)
    .build())

# Apply to single result
matches_weak = apply_pattern(interaction_pattern, weak_coupling)
print(f"Weak coupling: {len(matches_weak)} interaction patterns")

# Apply to multiple results at once
all_results = [weak_coupling, strong_coupling, different_delay]
all_matches = apply_pattern_to_multiple(interaction_pattern, all_results)

for i, (name, result) in enumerate(zip(['weak', 'strong', 'diff_delay'], all_results)):
    print(f"{name} coupling: {len(all_matches[i])} patterns")

# Comprehensive analysis across all results
analysis = analyze_pattern_across_results(interaction_pattern, all_results)
print(f"Total patterns found: {analysis['total_matches']}")
print(f"Average per result: {np.mean(analysis['matches_per_result']):.1f}")

# Time-windowed analysis across results
early_matches = apply_pattern_to_multiple(interaction_pattern, all_results, 
                                         start_time=0, end_time=20)
late_matches = apply_pattern_to_multiple(interaction_pattern, all_results, 
                                        start_time=30, end_time=50)

# Compare early vs late dynamics
for i, name in enumerate(['weak', 'strong', 'diff_delay']):
    early_count = len(early_matches[i])
    late_count = len(late_matches[i])
    ratio = late_count / early_count if early_count > 0 else 0
    print(f"{name}: early={early_count}, late={late_count}, ratio={ratio:.2f}")
```

## Development and Testing

### Running Tests

```bash
# Run all tests (79 tests total)
uv run python -m pytest tests/ -v

# Run specific test categories
uv run python -m pytest tests/test_simulation.py -v           # Simulation interface tests
uv run python -m pytest tests/test_pattern_matching.py -v     # Pattern matching tests
uv run python -m pytest tests/test_advanced_simulation.py -v  # Advanced scenario tests
uv run python -m pytest tests/test_standalone_patterns.py -v  # Standalone pattern tests
```

### Build Commands

```bash
# Build the C binary
make

# Build cross-compiled Linux binary (requires Docker)
make cross

# Clean build artifacts
make clean
```

## Understanding the Physics

The system simulated by this code exhibits **partial synchronization** - the synchrony can be regular or irregular depending on parameters. In regular cases, the system settles into periodic attractor states characterized by their permutation symmetry (e.g., S₂×S₂×S₁ containing 2 groups of 2 neurons and 1 singleton).

These states can be:
- **Stable**: System remains in the synchronization pattern
- **Unstable**: States form heteroclinic networks where each state is partially embedded in another's attractor basin

The pattern matching system is particularly powerful for analyzing these symmetry groups and transitions between different synchronization states.
