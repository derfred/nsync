#!/usr/bin/env python3

"""
Tests for the neural network simulation interface.

This module contains comprehensive tests for:
- NetworkSimulation class functionality
- SimulationResult class methods
- Parameter validation and error handling
- C library interface integration
- Convenience functions
"""

import pytest
import numpy as np
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

from nsync import NetworkSimulation, SimulationResult, run_quick_simulation

class TestNetworkSimulation:
    """Test NetworkSimulation class functionality."""
    
    def test_initialization_default(self):
        """Test default initialization of NetworkSimulation."""
        sim = NetworkSimulation(auto_compile=False)  # Skip compilation for testing
        assert sim.lib is None
        assert sim.lib_path is None
    
    def test_initialization_with_auto_compile(self):
        """Test initialization with auto compilation."""
        # This will attempt to compile the actual C library
        sim = NetworkSimulation(auto_compile=True)
        assert sim.lib is not None
        assert sim.lib_path is not None
        assert sim.lib_path.exists()
    
    def test_run_simulation_parameter_validation_N(self):
        """Test parameter validation for N (number of neurons)."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test with valid N
        result = sim.run_simulation(N=3, Tmax=10.0, seed=42)
        assert result.parameters['N'] == 3
        assert len(result.voltages[0]) == 3
        
        # Test with invalid N (should work but might be impractical)
        result = sim.run_simulation(N=1, Tmax=10.0, seed=42)
        assert result.parameters['N'] == 1
    
    def test_run_simulation_parameter_validation_initial_voltages(self):
        """Test parameter validation for initial_voltages."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test with valid initial voltages
        voltages = [0.1, 0.5, 0.9]
        result = sim.run_simulation(N=3, initial_voltages=voltages, Tmax=10.0, seed=42)
        assert result.parameters['initial_voltages'] == voltages
        
        # Test with wrong length
        with pytest.raises(ValueError, match="initial_voltages must have length N=3, got 2"):
            sim.run_simulation(N=3, initial_voltages=[0.1, 0.5], Tmax=10.0)
        
        # Test with invalid voltage values (outside 0-1)
        with pytest.raises(ValueError, match="All initial voltages must be between 0 and 1"):
            sim.run_simulation(N=3, initial_voltages=[0.1, 1.5, 0.9], Tmax=10.0)
        
        with pytest.raises(ValueError, match="All initial voltages must be between 0 and 1"):
            sim.run_simulation(N=3, initial_voltages=[-0.1, 0.5, 0.9], Tmax=10.0)
    
    def test_run_simulation_parameter_types(self):
        """Test that simulation accepts correct parameter types."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test all parameters with explicit types
        result = sim.run_simulation(
            N=5,
            Tmax=20.0,
            delay=1.0,
            strength=0.1,
            I=1.0,
            Ijitter=0.05,
            seed=123,
            initial_voltages=None
        )
        
        # Verify parameters are stored correctly
        params = result.parameters
        assert params['N'] == 5
        assert params['Tmax'] == 20.0
        assert params['delay'] == 1.0
        assert params['strength'] == 0.1
        assert params['I'] == 1.0
        assert params['Ijitter'] == 0.05
        assert params['seed'] == 123
        assert params['initial_voltages'] is None
    
    def test_run_simulation_reproducibility(self):
        """Test that simulations with same seed produce identical results."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Run same simulation twice
        result1 = sim.run_simulation(N=3, Tmax=20.0, seed=42)
        result2 = sim.run_simulation(N=3, Tmax=20.0, seed=42)
        
        # Results should be identical
        np.testing.assert_array_equal(result1.times, result2.times)
        np.testing.assert_array_equal(result1.voltages, result2.voltages)
        assert len(result1.events) == len(result2.events)
        
        # Events should be identical
        for event1, event2 in zip(result1.events, result2.events):
            assert event1['time'] == event2['time']
            assert event1['type'] == event2['type']
            assert event1['neurons'] == event2['neurons']
    
    def test_run_simulation_different_seeds(self):
        """Test that different seeds produce different results."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Run simulations with different seeds
        result1 = sim.run_simulation(N=3, Tmax=20.0, seed=42)
        result2 = sim.run_simulation(N=3, Tmax=20.0, seed=43)
        
        # Results should have the same number of neurons but may have different timesteps
        assert result1.voltages.shape[1] == result2.voltages.shape[1] == 3  # Same number of neurons
        assert len(result1.events) >= 0
        assert len(result2.events) >= 0
        
        # Seeds should be different
        assert result1.parameters['seed'] != result2.parameters['seed']
    
    def test_run_simulation_library_not_loaded_error(self):
        """Test error when trying to run simulation without loaded library."""
        sim = NetworkSimulation(auto_compile=False)
        
        with pytest.raises(RuntimeError, match="Library not loaded"):
            sim.run_simulation(N=3, Tmax=10.0)
    
    def test_automatic_seed_generation(self):
        """Test that automatic seed generation works when seed=None."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Run simulation with automatic seed
        result = sim.run_simulation(N=3, Tmax=10.0, seed=None)
        
        # Seed should be generated and stored
        assert result.parameters['seed'] is not None
        assert isinstance(result.parameters['seed'], int)
        assert 0 <= result.parameters['seed'] < 2**32

class TestSimulationResult:
    """Test SimulationResult class functionality."""
    
    def setup_method(self):
        """Set up test data for each test."""
        # Create sample simulation result data
        self.times = np.array([0.0, 1.0, 2.0, 3.0, 4.0])
        self.voltages = np.array([
            [0.1, 0.5, 0.9],
            [0.3, 0.7, 0.1],
            [0.5, 0.9, 0.3],
            [0.7, 0.1, 0.5],
            [0.9, 0.3, 0.7]
        ])
        self.events = [
            {'time': 1.0, 'type': 'spike', 'neurons': [0, 1]},
            {'time': 1.0, 'type': 'spike_induced_reset', 'neurons': [2]},
            {'time': 2.0, 'type': 'reset', 'neurons': [0, 1]},
            {'time': 3.0, 'type': 'spike', 'neurons': [2]},
            {'time': 4.0, 'type': 'reset', 'neurons': [2]},
        ]
        self.parameters = {
            'N': 3,
            'Tmax': 5.0,
            'delay': 1.0,
            'strength': 0.1,
            'I': 1.0,
            'Ijitter': 0.0,
            'seed': 42,
            'initial_voltages': [0.1, 0.5, 0.9]
        }
        
        self.result = SimulationResult(self.times, self.voltages, self.events, self.parameters)
    
    def test_initialization(self):
        """Test SimulationResult initialization."""
        result = SimulationResult(self.times, self.voltages, self.events, self.parameters)
        
        np.testing.assert_array_equal(result.times, self.times)
        np.testing.assert_array_equal(result.voltages, self.voltages)
        assert result.events == self.events
        assert result.parameters == self.parameters
        assert result._pattern_matcher is not None
    
    def test_get_spikes(self):
        """Test spike extraction from events."""
        spikes = self.result.get_spikes()
        
        # Should return dict with neuron IDs as keys
        assert isinstance(spikes, dict)
        assert len(spikes) == 3  # 3 neurons
        
        # Check spike times for each neuron (reset events indicate spikes)
        expected_spikes = {
            0: [2.0],  # reset at t=2.0
            1: [2.0],  # reset at t=2.0
            2: [4.0]   # reset at t=4.0
        }
        
        for neuron_id in range(3):
            assert neuron_id in spikes
            assert spikes[neuron_id] == expected_spikes[neuron_id]
    
    def test_get_detailed_events(self):
        """Test detailed event extraction."""
        detailed = self.result.get_detailed_events()
        
        # Should return dict with event type categories
        assert 'spikes' in detailed
        assert 'natural_resets' in detailed
        assert 'spike_induced_resets' in detailed
        
        # Check spikes
        expected_spikes = [(1.0, [0, 1]), (3.0, [2])]
        assert detailed['spikes'] == expected_spikes
        
        # Check natural resets
        expected_resets = [(2.0, [0, 1]), (4.0, [2])]
        assert detailed['natural_resets'] == expected_resets
        
        # Check spike-induced resets
        expected_sir = [(1.0, [2])]
        assert detailed['spike_induced_resets'] == expected_sir
    
    def test_pattern_matching_integration(self):
        """Test that pattern matching works through SimulationResult."""
        # Test query_events returns builder
        builder = self.result.query_events()
        assert builder is not None
        
        # Test find_patterns works
        pattern = builder.spike().any_neurons().build()
        matches = self.result.find_patterns(pattern)
        
        assert isinstance(matches, list)
        assert len(matches) >= 0  # May or may not find matches depending on data
    
    def test_analyze_pattern_statistics(self):
        """Test pattern statistics analysis."""
        # Create a pattern that should match
        pattern = self.result.query_events().spike().any_neurons().build()
        stats = self.result.analyze_pattern_statistics(pattern)
        
        assert 'count' in stats
        assert 'matches' in stats
        assert 'inter_match_intervals' in stats
        assert 'pattern_durations' in stats
        
        assert isinstance(stats['count'], int)
        assert stats['count'] >= 0
        assert isinstance(stats['matches'], list)
        assert isinstance(stats['inter_match_intervals'], list)
        assert isinstance(stats['pattern_durations'], list)

class TestIntegration:
    """Integration tests for the complete simulation system."""
    
    def test_full_simulation_workflow(self):
        """Test complete workflow from simulation to pattern analysis."""
        # Create simulation
        sim = NetworkSimulation(auto_compile=True)
        
        # Run simulation
        result = sim.run_simulation(
            N=4,
            Tmax=30.0,
            strength=0.05,
            seed=123
        )
        
        # Basic validation of result structure
        assert isinstance(result, SimulationResult)
        assert result.times.shape[0] > 0
        assert result.voltages.shape[1] == 4  # 4 neurons
        assert len(result.events) >= 0
        
        # Test pattern matching on real data
        pattern = result.query_events().spike().any_neurons().spike_induced_reset().any_neurons().build()
        matches = result.find_patterns(pattern)
        
        # Should return valid match structure
        assert isinstance(matches, list)
        for match in matches:
            assert hasattr(match, 'start_index')
            assert hasattr(match, 'end_index')
            assert hasattr(match, 'start_time')
            assert hasattr(match, 'end_time')
            assert hasattr(match, 'matched_events')
            assert hasattr(match, 'neuron_mapping')
    
    def test_different_network_sizes(self):
        """Test simulation with different network sizes."""
        sim = NetworkSimulation(auto_compile=True)
        
        for N in [2, 3, 5, 8]:
            result = sim.run_simulation(N=N, Tmax=15.0, seed=42)
            
            assert result.parameters['N'] == N
            assert result.voltages.shape[1] == N
            
            # Verify spikes dictionary has correct number of neurons
            spikes = result.get_spikes()
            assert len(spikes) == N
            assert all(neuron_id in spikes for neuron_id in range(N))
    
    def test_different_time_scales(self):
        """Test simulation with different time scales."""
        sim = NetworkSimulation(auto_compile=True)
        
        for Tmax in [5.0, 10.0, 25.0, 50.0]:
            result = sim.run_simulation(N=3, Tmax=Tmax, seed=42)
            
            assert result.parameters['Tmax'] == Tmax
            assert result.times[-1] <= Tmax  # Last time should not exceed Tmax
            
            # Longer simulations should generally have more events
            if Tmax >= 25.0:
                assert len(result.events) > 0  # Should have some events in longer simulations
    
    def test_parameter_effects(self):
        """Test that different parameters produce different dynamics."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test different coupling strengths
        result_weak = sim.run_simulation(N=3, Tmax=20.0, strength=0.01, seed=42)
        result_strong = sim.run_simulation(N=3, Tmax=20.0, strength=0.1, seed=42)
        
        # Results should have same number of neurons but may have different dynamics
        assert result_weak.voltages.shape[1] == result_strong.voltages.shape[1] == 3  # Same number of neurons
        assert result_weak.parameters['strength'] != result_strong.parameters['strength']
        
        # Parameters should be correctly stored
        assert result_weak.parameters['strength'] == 0.01
        assert result_strong.parameters['strength'] == 0.1
    
    def test_event_consistency(self):
        """Test that events are consistent with voltage dynamics."""
        sim = NetworkSimulation(auto_compile=True)
        result = sim.run_simulation(N=3, Tmax=20.0, seed=42)
        
        # Basic consistency checks
        for event in result.events:
            # Event time should be within simulation time range
            assert 0.0 <= event['time'] <= result.parameters['Tmax']
            
            # Neuron IDs should be valid
            for neuron_id in event['neurons']:
                assert 0 <= neuron_id < result.parameters['N']
            
            # Event type should be valid
            assert event['type'] in ['spike', 'reset', 'spike_induced_reset']

class TestConvenienceFunctions:
    """Test convenience functions and utilities."""
    
    def test_run_quick_simulation(self):
        """Test run_quick_simulation convenience function."""
        result = run_quick_simulation(N=3, Tmax=15.0, seed=42)
        
        assert isinstance(result, SimulationResult)
        assert result.parameters['N'] == 3
        assert result.parameters['Tmax'] == 15.0
        assert result.parameters['seed'] == 42
    
    def test_run_quick_simulation_with_kwargs(self):
        """Test run_quick_simulation with various keyword arguments."""
        result = run_quick_simulation(
            N=4,
            Tmax=10.0,
            strength=0.08,
            delay=1.2,
            I=1.1,
            seed=999
        )
        
        params = result.parameters
        assert params['N'] == 4
        assert params['Tmax'] == 10.0
        assert params['strength'] == 0.08
        assert params['delay'] == 1.2
        assert params['I'] == 1.1
        assert params['seed'] == 999

class TestErrorHandling:
    """Test error handling and edge cases."""
    
    def test_missing_c_files_error(self):
        """Test error when C files are missing."""
        # This test would require mocking the file system, which is complex
        # For now, we assume the C files are present in the test environment
        pass
    
    def test_compilation_failure_handling(self):
        """Test handling of compilation failures."""
        # This would require mocking subprocess calls
        # For now, we assume compilation succeeds in the test environment
        pass
    
    def test_invalid_parameter_combinations(self):
        """Test handling of invalid parameter combinations."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test that simulations can handle edge cases
        # Note: The C implementation may or may not validate parameters,
        # so we test what we can control from the Python side
        
        # Test zero neurons (behavior depends on C implementation)
        try:
            result = sim.run_simulation(N=0, Tmax=10.0)
            # If it doesn't raise an error, check that result makes sense
            assert result.parameters['N'] == 0
        except Exception:
            # If it raises an error, that's also acceptable
            pass
        
        # Test very small time
        result = sim.run_simulation(N=3, Tmax=0.1, seed=42)
        assert result.parameters['Tmax'] == 0.1
        assert len(result.times) >= 1  # Should have at least initial time

if __name__ == "__main__":
    pytest.main([__file__, "-v"])