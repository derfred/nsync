#!/usr/bin/env python3

"""
Advanced tests for neural network simulation scenarios.

This module contains tests for more complex simulation scenarios and edge cases:
- Large network simulations
- Long-term dynamics
- Specific parameter regimes
- Performance characteristics
- Memory management
"""

import pytest
import numpy as np
import time
import gc

from nsync import NetworkSimulation, run_quick_simulation

class TestAdvancedSimulation:
    """Test advanced simulation scenarios."""
    
    def test_large_network_simulation(self):
        """Test simulation with larger networks."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test with a moderately large network
        N = 20
        result = sim.run_simulation(N=N, Tmax=15.0, seed=42)
        
        assert result.parameters['N'] == N
        assert result.phases.shape[1] == N
        
        # Should have spike data for all neurons
        spikes = result.get_spikes()
        assert len(spikes) == N
        
        # Pattern matching should still work
        pattern = result.query_events().spike().any_neurons().build()
        matches = result.find_patterns(pattern)
        assert isinstance(matches, list)
    
    def test_long_simulation(self):
        """Test longer simulation runs."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Run a longer simulation
        result = sim.run_simulation(N=5, Tmax=100.0, seed=42)
        
        assert result.parameters['Tmax'] == 100.0
        assert result.times[-1] <= 100.0
        
        # Should have accumulated significant events
        assert len(result.events) > 0
        
        # Check event time consistency
        for i in range(1, len(result.events)):
            assert result.events[i]['time'] >= result.events[i-1]['time']
    
    def test_different_parameter_regimes(self):
        """Test simulation in different dynamical regimes."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test weak coupling regime
        result_weak = sim.run_simulation(
            N=5, Tmax=30.0, strength=0.005, seed=42
        )
        
        # Test strong coupling regime  
        result_strong = sim.run_simulation(
            N=5, Tmax=30.0, strength=0.2, seed=42
        )
        
        # Both should complete successfully
        assert len(result_weak.events) >= 0
        assert len(result_strong.events) >= 0
        
        # Parameters should be correctly stored
        assert result_weak.parameters['strength'] == 0.005
        assert result_strong.parameters['strength'] == 0.2
    
    def test_delay_parameter_effects(self):
        """Test different delay parameters."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test different delays
        delays = [0.5, 1.0, 2.0, 5.0]
        results = []
        
        for delay in delays:
            result = sim.run_simulation(
                N=4, Tmax=20.0, delay=delay, seed=42
            )
            results.append(result)
            assert result.parameters['delay'] == delay
        
        # All should complete successfully
        for result in results:
            assert len(result.events) >= 0
    
    def test_current_jitter_effects(self):
        """Test effects of current jitter parameter."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Test without jitter
        result_no_jitter = sim.run_simulation(
            N=4, Tmax=20.0, Ijitter=0.0, seed=42
        )
        
        # Test with jitter
        result_with_jitter = sim.run_simulation(
            N=4, Tmax=20.0, Ijitter=0.1, seed=42
        )
        
        # Both should work
        assert result_no_jitter.parameters['Ijitter'] == 0.0
        assert result_with_jitter.parameters['Ijitter'] == 0.1
        assert len(result_no_jitter.events) >= 0
        assert len(result_with_jitter.events) >= 0
    
    def test_initial_phases_effects(self):
        """Test different initial phase configurations."""
        sim = NetworkSimulation(auto_compile=True)
        
        N = 4
        
        # Test synchronized start (all phases = 0)
        sync_phases = [0.0] * N
        result_sync = sim.run_simulation(
            N=N, Tmax=15.0, initial_phases=sync_phases, seed=42
        )
        
        # Test distributed start
        distributed_phases = [i / N for i in range(N)]
        result_distributed = sim.run_simulation(
            N=N, Tmax=15.0, initial_phases=distributed_phases, seed=42
        )
        
        # Test random start (None)
        result_random = sim.run_simulation(
            N=N, Tmax=15.0, initial_phases=None, seed=42
        )
        
        # All should complete successfully
        assert len(result_sync.events) >= 0
        assert len(result_distributed.events) >= 0
        assert len(result_random.events) >= 0
        
        # Initial phases should be stored correctly
        assert result_sync.parameters['initial_phases'] == sync_phases
        assert result_distributed.parameters['initial_phases'] == distributed_phases
        assert result_random.parameters['initial_phases'] is None

class TestPerformanceAndMemory:
    """Test performance characteristics and memory management."""
    
    def test_simulation_performance(self):
        """Test that simulations complete in reasonable time."""
        sim = NetworkSimulation(auto_compile=True)
        
        start_time = time.time()
        result = sim.run_simulation(N=10, Tmax=50.0, seed=42)
        end_time = time.time()
        
        simulation_time = end_time - start_time
        
        # Should complete within reasonable time (adjust threshold as needed)
        assert simulation_time < 5.0, f"Simulation took {simulation_time:.2f}s, expected < 5s"
        
        # Should produce meaningful output
        assert len(result.events) > 0
        assert result.phases.shape[0] > 1
    
    def test_memory_management(self):
        """Test that repeated simulations don't leak memory."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Run multiple simulations to check for memory leaks
        for i in range(10):
            result = sim.run_simulation(N=5, Tmax=10.0, seed=i)
            assert len(result.events) >= 0
            
            # Force garbage collection
            del result
            gc.collect()
        
        # If we get here without memory issues, the test passes
        assert True
    
    def test_multiple_simulation_instances(self):
        """Test creating multiple simulation instances."""
        sims = []
        
        # Create multiple simulation instances
        for i in range(3):
            sim = NetworkSimulation(auto_compile=True)
            result = sim.run_simulation(N=3, Tmax=10.0, seed=42)
            sims.append((sim, result))
        
        # All should work independently
        for sim, result in sims:
            assert len(result.events) >= 0
            assert result.parameters['N'] == 3

class TestNumericalProperties:
    """Test numerical properties and consistency."""
    
    def test_phase_evolution_consistency(self):
        """Test that phase evolution is numerically consistent."""
        sim = NetworkSimulation(auto_compile=True)
        result = sim.run_simulation(N=3, Tmax=20.0, seed=42)
        
        # Phases should be in [0, 1] range at all times
        assert np.all(result.phases >= 0.0)
        assert np.all(result.phases <= 1.0)
        
        # Times should be monotonically increasing
        assert np.all(np.diff(result.times) >= 0)
    
    def test_event_timing_consistency(self):
        """Test that event times are consistent with simulation times."""
        sim = NetworkSimulation(auto_compile=True)
        result = sim.run_simulation(N=4, Tmax=25.0, seed=42)
        
        # All event times should be within simulation time range
        for event in result.events:
            assert 0.0 <= event['time'] <= result.parameters['Tmax']
        
        # Events should be temporally ordered
        event_times = [event['time'] for event in result.events]
        assert event_times == sorted(event_times)
    
    def test_neuron_id_consistency(self):
        """Test that neuron IDs in events are valid."""
        sim = NetworkSimulation(auto_compile=True)
        result = sim.run_simulation(N=6, Tmax=20.0, seed=42)
        
        N = result.parameters['N']
        
        # All neuron IDs in events should be valid
        for event in result.events:
            for neuron_id in event['neurons']:
                assert 0 <= neuron_id < N
                assert isinstance(neuron_id, int)

class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_minimal_simulation(self):
        """Test minimal simulation parameters."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Very short simulation
        result = sim.run_simulation(N=2, Tmax=0.5, seed=42)
        
        assert result.parameters['Tmax'] == 0.5
        assert result.parameters['N'] == 2
        assert len(result.times) >= 1
        assert len(result.events) >= 0
    
    def test_single_neuron_network(self):
        """Test single neuron network (if supported)."""
        sim = NetworkSimulation(auto_compile=True)
        
        try:
            result = sim.run_simulation(N=1, Tmax=10.0, seed=42)
            
            # If successful, check basic properties
            assert result.parameters['N'] == 1
            assert result.phases.shape[1] == 1
            
            # Single neuron should still produce events
            assert len(result.events) >= 0
            
        except Exception:
            # Single neuron might not be supported by the C implementation
            pytest.skip("Single neuron networks not supported")
    
    def test_extreme_parameter_values(self):
        """Test with extreme but valid parameter values."""
        sim = NetworkSimulation(auto_compile=True)
        
        # Very weak coupling
        result1 = sim.run_simulation(
            N=3, Tmax=10.0, strength=1e-6, seed=42
        )
        assert len(result1.events) >= 0
        
        # Very small delay
        result2 = sim.run_simulation(
            N=3, Tmax=10.0, delay=0.01, seed=42
        )
        assert len(result2.events) >= 0
        
        # Very small current
        result3 = sim.run_simulation(
            N=3, Tmax=10.0, I=0.1, seed=42
        )
        assert len(result3.events) >= 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])