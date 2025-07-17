nsync - event based neural network simulator for pulse coupled neurons
======================================================================

This package implements a C & Python based simulator for pulse coupled neural networks with delay as introduced in:

> U. Ernst, K. Pawelzik, and T. Geisel. Synchronization induced by temporal
> delays in pulse-coupled oscillators. Phys. Rev. Lett., 74, 1995.
> http://www.nld.ds.mpg.de/downloads/publications/p1570_1.pdf

The algorithm is based on the concept of numerically exact integration as presented in:

> Rotter S and Diesmann M. Exact Digital Simulation of Time-Invariant Linear Systems
> with Applications to Neuronal Modeling. Biological Cybernetics 81:381-402 (1999)
> http://www.springerlink.com/content/08legf57tjkc6nj0 (no publically available version)


### Basic Usage

```python
from nsync_python import NetworkSimulation

# Create simulation instance
sim = NetworkSimulation()

# Run simulation with custom parameters
result = sim.run_simulation(
    N=5,           # Number of neurons
    Tmax=100.0,    # Simulation time
    strength=0.05, # Coupling strength
    delay=1.59,    # Spike delay
    I=1.04,        # Base current
    seed=42        # Random seed
)

# Access results
print(f"Simulation ran for {len(result['times'])} time steps")
print(f"Phase data shape: {result['phases'].shape}")  # (timesteps, neurons)
print(f"Number of events: {len(result['events'])}")
```

### Extract Spike Information

```python
# Get spike times for each neuron
spikes = sim.get_spikes(result)
for neuron_id, spike_times in spikes.items():
    print(f"Neuron {neuron_id}: {len(spike_times)} spikes")
    print(f"  First few spike times: {spike_times[:3]}")

# Convert to binary spike trains
spike_trains, time_bins = sim.get_spike_trains(result, dt=0.1)
print(f"Spike train shape: {spike_trains.shape}")  # (time_bins, neurons)
```
