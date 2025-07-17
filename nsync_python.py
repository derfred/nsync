#!/usr/bin/env python3

import ctypes
import numpy as np
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import time

class NetworkSimulation:
    """Python interface to the nsync network simulation."""
    
    def __init__(self, auto_compile: bool = True):
        """Initialize the network simulation interface.
        
        Args:
            auto_compile: Whether to automatically compile the C library if needed
        """
        self.lib = None
        self.lib_path = None
        
        if auto_compile:
            self._compile_library()
            self._load_library()
    
    def _compile_library(self):
        """Compile the C library as a shared object."""
        nsync_dir = Path("nsync")
        
        # Check if source files exist
        if not nsync_dir.exists():
            raise FileNotFoundError("nsync directory not found")
        
        required_files = ["nsync.h", "nsync_lib.c", "nsync_lib.h", "nsync_core.c", "nsync_core.h", "config.c"]
        for file in required_files:
            if not (nsync_dir / file).exists():
                raise FileNotFoundError(f"Required file {file} not found in nsync directory")
        
        # Compile as shared library
        self.lib_path = nsync_dir / "libnsync.so"
        
        # Check if library already exists and source files haven't changed
        needs_compile = True
        if self.lib_path.exists():
            lib_mtime = self.lib_path.stat().st_mtime
            source_files = ["nsync_lib.c", "nsync_core.c", "config.c", "nsync.h", "nsync_lib.h", "nsync_core.h"]
            max_source_mtime = max((nsync_dir / f).stat().st_mtime for f in source_files)
            needs_compile = max_source_mtime > lib_mtime
        
        if needs_compile:
            compile_cmd = [
                "gcc", "-shared", "-fPIC", "-o", str(self.lib_path),
                str(nsync_dir / "nsync_lib.c"),
                str(nsync_dir / "nsync_core.c"),
                str(nsync_dir / "config.c"),
                "-lm"  # Link math library
            ]
            
            print("Compiling C library...")
            try:
                result = subprocess.run(compile_cmd, capture_output=True, text=True, check=True)
                print("✓ C library compiled successfully")
            except subprocess.CalledProcessError as e:
                print(f"Compilation failed: {e.stderr}")
                raise RuntimeError(f"Failed to compile C library: {e.stderr}")
        else:
            print("✓ Using existing C library")
    
    def _load_library(self):
        """Load the compiled C library."""
        if not self.lib_path or not self.lib_path.exists():
            raise FileNotFoundError("Compiled library not found")
        
        self.lib = ctypes.CDLL(str(self.lib_path))
        
        # Define Network structure
        class Network(ctypes.Structure):
            _fields_ = [
                ("N", ctypes.c_int),
                ("now", ctypes.c_double),
                ("Tmax", ctypes.c_double),
                ("delay", ctypes.c_double),
                ("strength", ctypes.c_double),
                ("Ijitter", ctypes.c_double),
                ("currents", ctypes.POINTER(ctypes.c_double)),
                ("periods", ctypes.POINTER(ctypes.c_double)),
                ("phases", ctypes.POINTER(ctypes.c_double)),
                ("resets", ctypes.POINTER(ctypes.c_double)),
            ]
        
        # Define SimulationResult structure
        class SimulationResult(ctypes.Structure):
            _fields_ = [
                ("times", ctypes.POINTER(ctypes.c_double)),
                ("phases_data", ctypes.POINTER(ctypes.c_double)),
                ("events_data", ctypes.POINTER(ctypes.c_char)),
                ("num_timesteps", ctypes.c_int),
                ("N", ctypes.c_int),
                ("capacity", ctypes.c_int),
            ]
        
        self.Network = Network
        self.SimulationResult = SimulationResult
        
        # Define function signatures
        self.lib.init_network_with_params.argtypes = [
            ctypes.POINTER(Network),
            ctypes.c_int,    # N
            ctypes.c_double, # Tmax
            ctypes.c_double, # delay
            ctypes.c_double, # strength
            ctypes.c_double, # I
            ctypes.c_double, # Ijitter
            ctypes.c_uint    # seed
        ]
        self.lib.init_network_with_params.restype = None
        
        self.lib.run_network_simulation.argtypes = [ctypes.POINTER(Network)]
        self.lib.run_network_simulation.restype = ctypes.POINTER(SimulationResult)
        
        self.lib.free_network.argtypes = [ctypes.POINTER(Network)]
        self.lib.free_network.restype = None
        
        self.lib.free_simulation_result.argtypes = [ctypes.POINTER(SimulationResult)]
        self.lib.free_simulation_result.restype = None
    
    def run_simulation(
        self,
        N: int = 5,
        Tmax: float = 150.0,
        delay: float = 1.59,
        strength: float = 0.025,
        I: float = 1.04,
        Ijitter: float = 0.0,
        seed: Optional[int] = None
    ) -> Dict:
        """Run a network simulation with the given parameters.
        
        Args:
            N: Number of neurons
            Tmax: Maximum simulation time
            delay: Spike delay
            strength: Coupling strength
            I: Base current
            Ijitter: Current jitter between neurons
            seed: Random seed (uses current time if None)
        
        Returns:
            Dictionary containing:
            - 'times': Array of time points
            - 'phases': 2D array of phases (timesteps x neurons)
            - 'events': List of event dictionaries with 'time', 'type', 'neurons'
            - 'parameters': Dictionary of simulation parameters
        """
        if self.lib is None:
            raise RuntimeError("Library not loaded. Call _load_library() first.")
        
        if seed is None:
            seed = int(time.time() * 1000000) % (2**32)
        
        # Create network structure
        network = self.Network()
        
        # Initialize network
        self.lib.init_network_with_params(
            ctypes.byref(network), N, Tmax, delay, strength, I, Ijitter, seed
        )
        
        try:
            # Run simulation
            result_ptr = self.lib.run_network_simulation(ctypes.byref(network))
            result = result_ptr.contents
            
            # Extract times
            times = np.array([result.times[i] for i in range(result.num_timesteps)])
            
            # Extract phases (reshape to timesteps x neurons)
            phases_flat = np.array([
                result.phases_data[i] for i in range(result.num_timesteps * result.N)
            ])
            phases = phases_flat.reshape(result.num_timesteps, result.N)
            
            # Extract events
            events = []
            event_len = result.N + 3
            for i in range(result.num_timesteps):
                event_str = ""
                for j in range(event_len):
                    char_val = result.events_data[i * event_len + j]
                    # Convert bytes to int if needed
                    if isinstance(char_val, bytes):
                        char_val = ord(char_val) if len(char_val) > 0 else 0
                    event_str += chr(char_val) if char_val != 0 else ""
                
                # Parse event string (format: "r\t01010" or "s\t10001")
                if len(event_str) >= 2:
                    event_type = event_str[0]  # 'r' for reset, 's' for spike
                    if len(event_str) > 2:
                        bitmap_str = event_str[2:]  # Skip type and tab
                        active_neurons = [
                            idx for idx, bit in enumerate(bitmap_str) 
                            if bit == '1' and idx < N
                        ]
                        events.append({
                            'time': times[i],
                            'type': 'reset' if event_type == 'r' else 'spike',
                            'neurons': active_neurons
                        })
            
            # Clean up C memory
            self.lib.free_simulation_result(result_ptr)
            
            return {
                'times': times,
                'phases': phases,
                'events': events,
                'parameters': {
                    'N': N,
                    'Tmax': Tmax,
                    'delay': delay,
                    'strength': strength,
                    'I': I,
                    'Ijitter': Ijitter,
                    'seed': seed
                }
            }
        
        finally:
            # Clean up network memory
            self.lib.free_network(ctypes.byref(network))
    
    def get_spikes(self, simulation_result: Dict) -> Dict:
        """Extract spike times for each neuron from simulation results.
        
        Args:
            simulation_result: Result dictionary from run_simulation()
        
        Returns:
            Dictionary with neuron indices as keys and lists of spike times as values
        """
        spikes = {i: [] for i in range(simulation_result['parameters']['N'])}
        
        for event in simulation_result['events']:
            if event['type'] == 'reset':  # Reset events indicate spikes
                for neuron_id in event['neurons']:
                    spikes[neuron_id].append(event['time'])
        
        return spikes
    
    def get_spike_trains(self, simulation_result: Dict, dt: float = 0.1) -> np.ndarray:
        """Convert spike times to binary spike trains.
        
        Args:
            simulation_result: Result dictionary from run_simulation()
            dt: Time bin size for spike trains
        
        Returns:
            2D numpy array (time_bins x neurons) of binary spike trains
        """
        Tmax = simulation_result['parameters']['Tmax']
        N = simulation_result['parameters']['N']
        spikes = self.get_spikes(simulation_result)
        
        time_bins = np.arange(0, Tmax + dt, dt)
        spike_trains = np.zeros((len(time_bins), N))
        
        for neuron_id, spike_times in spikes.items():
            for spike_time in spike_times:
                bin_idx = int(spike_time / dt)
                if bin_idx < len(time_bins):
                    spike_trains[bin_idx, neuron_id] = 1
        
        return spike_trains, time_bins


# Convenience function for quick simulations
def run_quick_simulation(**kwargs) -> Dict:
    """Run a simulation with default parameters.
    
    Args:
        **kwargs: Parameters to pass to run_simulation()
    
    Returns:
        Simulation result dictionary
    """
    sim = NetworkSimulation()
    return sim.run_simulation(**kwargs)


if __name__ == "__main__":
    # Example usage
    print("Running example network simulation...")
    
    # Create simulation instance
    sim = NetworkSimulation()
    
    # Run simulation with custom parameters
    result = sim.run_simulation(
        N=3,
        Tmax=50.0,
        strength=0.05,
        seed=42
    )
    
    print(f"Simulation completed!")
    print(f"- {len(result['times'])} time steps")
    print(f"- {len(result['events'])} events")
    print(f"- Phase data shape: {result['phases'].shape}")
    
    # Get spike times
    spikes = sim.get_spikes(result)
    print(f"\nSpike times per neuron:")
    for neuron_id, spike_times in spikes.items():
        print(f"  Neuron {neuron_id}: {len(spike_times)} spikes")
        if spike_times:
            print(f"    Times: {spike_times[:5]}{'...' if len(spike_times) > 5 else ''}")
    
    # Show first few events
    print(f"\nFirst 5 events:")
    for i, event in enumerate(result['events'][:5]):
        print(f"  {event}") 