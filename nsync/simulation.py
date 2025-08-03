#!/usr/bin/env python3

"""
Neural network simulation interface and result management.

This module provides the main simulation interface and result handling for
the nsync neural network simulator, including:
- NetworkSimulation class for running simulations
- SimulationResult class for managing and analyzing results
- Pattern query capabilities integrated with results
"""

import ctypes
import numpy as np
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import time

from .patterns import PatternMatcher, PatternQueryBuilder, EventPattern, PatternMatch

class SimulationResult:
    """Represents the results of a network simulation with pattern query capabilities."""
    
    def __init__(self, times: np.ndarray, phases: np.ndarray, events: List[Dict], 
                 parameters: Dict):
        """Initialize simulation result.
        
        Args:
            times: Array of time points
            phases: 2D array of phases (timesteps x neurons)
            events: List of event dictionaries
            parameters: Simulation parameters
        """
        self.times = times
        self.phases = phases
        self.events = events
        self.parameters = parameters
        self._pattern_matcher = PatternMatcher()
    
    def query_events(self) -> PatternQueryBuilder:
        """Get a pattern query builder for creating event patterns.
        
        Returns:
            PatternQueryBuilder instance for chaining pattern specifications
        """
        return PatternQueryBuilder()
    
    def find_patterns(self, pattern: EventPattern, 
                     start_time: Optional[float] = None, 
                     end_time: Optional[float] = None) -> List[PatternMatch]:
        """Find all occurrences of a pattern in the simulation events.
        
        Args:
            pattern: EventPattern to search for (can be created independently)
            start_time: Optional start time for search window
            end_time: Optional end time for search window
            
        Returns:
            List of PatternMatch objects
        """
        return self._pattern_matcher.find_matches(self.events, pattern, start_time, end_time)
    
    def apply_external_pattern(self, pattern: EventPattern, 
                              start_time: Optional[float] = None, 
                              end_time: Optional[float] = None) -> List[PatternMatch]:
        """Apply an externally created pattern to this simulation result.
        
        This is an alias for find_patterns() to make the API more explicit
        when using patterns created with create_pattern().
        
        Args:
            pattern: EventPattern created independently (e.g., with create_pattern())
            start_time: Optional start time for search window
            end_time: Optional end time for search window
            
        Returns:
            List of PatternMatch objects
        """
        return self.find_patterns(pattern, start_time, end_time)
    
    def analyze_pattern_statistics(self, pattern: EventPattern) -> Dict:
        """Analyze statistics about pattern occurrences.
        
        Args:
            pattern: EventPattern to analyze
            
        Returns:
            Dictionary with statistics about pattern matches
        """
        matches = self.find_patterns(pattern)
        
        inter_match_intervals = []
        pattern_durations = []
        
        for i, match in enumerate(matches):
            pattern_durations.append(match.duration)
            
            if i > 0:
                interval = match.start_time - matches[i-1].end_time
                inter_match_intervals.append(interval)
        
        return {
            'count': len(matches),
            'matches': matches,
            'inter_match_intervals': inter_match_intervals,
            'pattern_durations': pattern_durations
        }
    
    def get_spikes(self) -> Dict[int, List[float]]:
        """Extract spike times for each neuron."""
        spikes = {i: [] for i in range(self.parameters['N'])}
        
        for event in self.events:
            if event['type'] == 'reset':
                for neuron_id in event['neurons']:
                    spikes[neuron_id].append(event['time'])
        
        return spikes
    
    def get_detailed_events(self) -> Dict[str, List[Tuple[float, List[int]]]]:
        """Extract detailed event information."""
        result = {
            'spikes': [],
            'natural_resets': [],
            'spike_induced_resets': []
        }
        
        for event in self.events:
            time_neurons = (event['time'], event['neurons'])
            
            if event['type'] == 'spike':
                result['spikes'].append(time_neurons)
            elif event['type'] == 'reset':
                result['natural_resets'].append(time_neurons)
            elif event['type'] == 'spike_induced_reset':
                result['spike_induced_resets'].append(time_neurons)
        
        return result

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
        nsync_dir = Path(__file__).parent
        
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

            try:
                subprocess.run(compile_cmd, capture_output=True, text=True, check=True)
            except subprocess.CalledProcessError as e:
                raise RuntimeError(f"Failed to compile C library: {e.stderr}")
    
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
        class CSimulationResult(ctypes.Structure):
            _fields_ = [
                ("times", ctypes.POINTER(ctypes.c_double)),
                ("phases_data", ctypes.POINTER(ctypes.c_double)),
                ("spike_maps", ctypes.POINTER(ctypes.c_int)),
                ("reset_maps", ctypes.POINTER(ctypes.c_int)),
                ("total_reset_maps", ctypes.POINTER(ctypes.c_int)),
                ("num_timesteps", ctypes.c_int),
                ("N", ctypes.c_int),
                ("capacity", ctypes.c_int),
            ]
        
        self.Network = Network
        self.CSimulationResult = CSimulationResult
        
        # Define function signatures
        self.lib.init_network.argtypes = [
            ctypes.POINTER(Network),
            ctypes.c_int,    # N
            ctypes.c_double, # Tmax
            ctypes.c_double, # delay
            ctypes.c_double, # strength
            ctypes.c_double, # I
            ctypes.c_double, # Ijitter
            ctypes.c_uint,   # seed
            ctypes.POINTER(ctypes.c_double)  # initial_phases (NULL for random)
        ]
        self.lib.init_network.restype = None
        
        self.lib.run_network_simulation.argtypes = [ctypes.POINTER(Network)]
        self.lib.run_network_simulation.restype = ctypes.POINTER(CSimulationResult)
        
        self.lib.free_network.argtypes = [ctypes.POINTER(Network)]
        self.lib.free_network.restype = None
        
        self.lib.free_simulation_result.argtypes = [ctypes.POINTER(CSimulationResult)]
        self.lib.free_simulation_result.restype = None
    
    def run_simulation(
        self,
        N: int = 5,
        Tmax: float = 150.0,
        delay: float = 1.59,
        strength: float = 0.025,
        I: float = 1.04,
        Ijitter: float = 0.0,
        seed: Optional[int] = None,
        initial_phases: Optional[List[float]] = None
    ) -> SimulationResult:
        """Run a network simulation with the given parameters.
        
        Args:
            N: Number of neurons
            Tmax: Maximum simulation time
            delay: Spike delay
            strength: Coupling strength
            I: Base current
            Ijitter: Current jitter between neurons
            seed: Random seed (uses current time if None)
            initial_phases: List of initial phases for each neuron (0-1), 
                          if None uses random phases
        
        Returns:
            SimulationResult object with pattern query capabilities
        """
        if self.lib is None:
            raise RuntimeError("Library not loaded. Call _load_library() first.")
        
        if seed is None:
            seed = int(time.time() * 1000000) % (2**32)
        
        # Validate initial_phases if provided
        if initial_phases is not None:
            if len(initial_phases) != N:
                raise ValueError(f"initial_phases must have length N={N}, got {len(initial_phases)}")
            if not all(0 <= phase <= 1 for phase in initial_phases):
                raise ValueError("All initial phases must be between 0 and 1")
        
        # Create network structure
        network = self.Network()
        
        # Initialize network
        if initial_phases is None:
            # Use random initialization
            self.lib.init_network(
                ctypes.byref(network), N, Tmax, delay, strength, I, Ijitter, seed, None
            )
        else:
            # Use specified initial phases
            phases_array = (ctypes.c_double * N)(*initial_phases)
            self.lib.init_network(
                ctypes.byref(network), N, Tmax, delay, strength, I, Ijitter, seed, phases_array
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
            
            # Extract events from bitmap data
            events = []
            for i in range(result.num_timesteps):
                spike_map = result.spike_maps[i]
                reset_map = result.reset_maps[i]
                total_reset_map = result.total_reset_maps[i]
                
                # Extract spike events
                if spike_map > 0:
                    spike_neurons = [
                        neuron_id for neuron_id in range(N)
                        if spike_map & (1 << neuron_id)
                    ]
                    if spike_neurons:
                        events.append({
                            'time': times[i],
                            'type': 'spike',
                            'neurons': spike_neurons
                        })
                
                # Extract reset events (natural resets)
                if reset_map > 0:
                    reset_neurons = [
                        neuron_id for neuron_id in range(N)
                        if reset_map & (1 << neuron_id)
                    ]
                    if reset_neurons:
                        events.append({
                            'time': times[i],
                            'type': 'reset',
                            'neurons': reset_neurons
                        })
                
                # Extract spike-induced reset events
                spike_induced_reset_map = total_reset_map & ~reset_map
                if spike_induced_reset_map > 0:
                    spike_induced_reset_neurons = [
                        neuron_id for neuron_id in range(N)
                        if spike_induced_reset_map & (1 << neuron_id)
                    ]
                    if spike_induced_reset_neurons:
                        events.append({
                            'time': times[i],
                            'type': 'spike_induced_reset',
                            'neurons': spike_induced_reset_neurons
                        })
            
            # Clean up C memory
            self.lib.free_simulation_result(result_ptr)
            
            # Create parameters dictionary
            parameters = {
                'N': N,
                'Tmax': Tmax,
                'delay': delay,
                'strength': strength,
                'I': I,
                'Ijitter': Ijitter,
                'seed': seed,
                'initial_phases': initial_phases
            }
            
            return SimulationResult(times, phases, events, parameters)
        
        finally:
            # Clean up network memory
            self.lib.free_network(ctypes.byref(network))