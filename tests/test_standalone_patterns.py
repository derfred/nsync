#!/usr/bin/env python3

"""
Tests for standalone pattern creation and multi-result analysis functionality.

This module tests the new standalone pattern functionality that allows:
- Creating patterns independent of result objects
- Applying patterns to single results
- Applying patterns to multiple results
- Analyzing pattern statistics across multiple results
"""

import pytest
import numpy as np

from nsync import NetworkSimulation, create_pattern, apply_pattern, apply_pattern_to_multiple, analyze_pattern_across_results

class TestStandalonePatterns:
    """Test standalone pattern creation and application."""
    
    def setup_method(self):
        """Set up test data with multiple simulation results."""
        self.sim = NetworkSimulation(auto_compile=True)
        
        # Create multiple simulation results with different seeds
        self.results = []
        for seed in [42, 43, 44]:
            result = self.sim.run_simulation(N=4, Tmax=30.0, seed=seed)
            self.results.append(result)
    
    def test_create_pattern_basic(self):
        """Test basic standalone pattern creation."""
        # Create pattern independent of any result
        pattern = create_pattern().spike().any_neurons().build()
        
        # Pattern should be valid
        assert pattern is not None
        assert len(pattern.steps) == 1
        assert pattern.steps[0]['type'] == 'spike'
    
    def test_create_pattern_complex(self):
        """Test creating complex standalone patterns."""
        # Create multi-step pattern
        pattern = (create_pattern()
            .spike().exactly(1, 3)
            .spike_induced_reset().exactly(0)
            .reset().same_as(0)
            .build())
        
        assert len(pattern.steps) == 3
        assert pattern.steps[0]['type'] == 'spike'
        assert pattern.steps[1]['type'] == 'spike_induced_reset'
        assert pattern.steps[2]['type'] == 'reset'
        
        # Check neuron specifications
        assert pattern.steps[0]['neurons']['type'] == 'exact'
        assert pattern.steps[0]['neurons']['ids'] == [1, 3]
        assert pattern.steps[1]['neurons']['type'] == 'exact'
        assert pattern.steps[1]['neurons']['ids'] == [0]
        assert pattern.steps[2]['neurons']['type'] == 'reference'
        assert pattern.steps[2]['neurons']['step'] == 0
    
    def test_create_pattern_groups(self):
        """Test creating group-based patterns."""
        pattern = (create_pattern()
            .spike().groups(2)
            .spike_induced_reset().groups(1)
            .build())
        
        assert len(pattern.steps) == 2
        assert pattern.steps[0]['neurons']['type'] == 'groups'
        assert pattern.steps[0]['neurons']['sizes'] == [2]
        assert pattern.steps[1]['neurons']['type'] == 'groups'
        assert pattern.steps[1]['neurons']['sizes'] == [1]
    
    def test_apply_pattern_to_single_result(self):
        """Test applying standalone pattern to single result."""
        # Create pattern
        pattern = create_pattern().spike().any_neurons().build()
        
        # Apply to single result
        matches = apply_pattern(pattern, self.results[0])
        
        assert isinstance(matches, list)
        # Should find some matches in a reasonable simulation
        assert len(matches) >= 0
        
        # Each match should have required fields
        for match in matches:
            assert 'start_time' in match
            assert 'end_time' in match
            assert 'matched_events' in match
    
    def test_apply_pattern_with_time_window(self):
        """Test applying pattern with time constraints."""
        pattern = create_pattern().spike().any_neurons().build()
        
        # Apply with time window
        matches = apply_pattern(pattern, self.results[0], start_time=5.0, end_time=15.0)
        
        assert isinstance(matches, list)
        
        # All matches should be within time window
        for match in matches:
            assert match['start_time'] >= 5.0
            assert match['end_time'] <= 15.0
    
    def test_apply_pattern_to_multiple_results(self):
        """Test applying pattern to multiple results."""
        pattern = create_pattern().spike().any_neurons().build()
        
        # Apply to multiple results
        all_matches = apply_pattern_to_multiple(pattern, self.results)
        
        assert isinstance(all_matches, dict)
        assert len(all_matches) == len(self.results)
        
        # Each result should have a list of matches
        for i in range(len(self.results)):
            assert i in all_matches
            assert isinstance(all_matches[i], list)
    
    def test_apply_pattern_to_multiple_with_time_window(self):
        """Test applying pattern to multiple results with time constraints."""
        pattern = create_pattern().spike().any_neurons().build()
        
        # Apply with time window
        all_matches = apply_pattern_to_multiple(pattern, self.results, 
                                               start_time=10.0, end_time=20.0)
        
        assert isinstance(all_matches, dict)
        
        # Check time constraints for all results
        for result_idx, matches in all_matches.items():
            for match in matches:
                assert match['start_time'] >= 10.0
                assert match['end_time'] <= 20.0
    
    def test_analyze_pattern_across_results_basic(self):
        """Test basic pattern analysis across multiple results."""
        pattern = create_pattern().spike().any_neurons().build()
        
        # Analyze across all results
        analysis = analyze_pattern_across_results(pattern, self.results)
        
        # Check required fields
        assert 'total_matches' in analysis
        assert 'matches_per_result' in analysis
        assert 'result_statistics' in analysis
        assert 'aggregated_durations' in analysis
        assert 'aggregated_intervals' in analysis
        
        # Check data consistency
        assert isinstance(analysis['total_matches'], int)
        assert analysis['total_matches'] >= 0
        assert len(analysis['matches_per_result']) == len(self.results)
        assert len(analysis['result_statistics']) == len(self.results)
        
        # Total matches should equal sum of individual matches
        assert analysis['total_matches'] == sum(analysis['matches_per_result'])
    
    def test_analyze_pattern_across_results_statistics(self):
        """Test statistical analysis across results."""
        pattern = (create_pattern()
            .spike().any_neurons()
            .spike_induced_reset().any_neurons()
            .build())
        
        analysis = analyze_pattern_across_results(pattern, self.results)
        
        # Check per-result statistics
        for i, result_stats in enumerate(analysis['result_statistics']):
            assert 'count' in result_stats
            assert 'durations' in result_stats
            assert 'intervals' in result_stats
            
            # Count should match matches_per_result
            assert result_stats['count'] == analysis['matches_per_result'][i]
            
            # Durations list should have same length as count
            assert len(result_stats['durations']) == result_stats['count']
            
            # Intervals should have count-1 entries (if count > 1)
            if result_stats['count'] > 1:
                assert len(result_stats['intervals']) == result_stats['count'] - 1
            else:
                assert len(result_stats['intervals']) == 0

class TestStandalonePatternEdgeCases:
    """Test edge cases for standalone pattern functionality."""
    
    def setup_method(self):
        """Set up minimal test data."""
        self.sim = NetworkSimulation(auto_compile=True)
        self.result = self.sim.run_simulation(N=3, Tmax=10.0, seed=42)
    
    def test_apply_pattern_empty_results(self):
        """Test applying pattern to empty results list."""
        pattern = create_pattern().spike().any_neurons().build()
        
        all_matches = apply_pattern_to_multiple(pattern, [])
        assert all_matches == {}
        
        analysis = analyze_pattern_across_results(pattern, [])
        assert analysis['total_matches'] == 0
        assert analysis['matches_per_result'] == []
        assert analysis['result_statistics'] == []
        assert analysis['aggregated_durations'] == []
        assert analysis['aggregated_intervals'] == []
    
    def test_apply_pattern_no_matches(self):
        """Test applying pattern that finds no matches."""
        # Create very specific pattern unlikely to match
        pattern = (create_pattern()
            .spike().exactly(0, 1, 2)
            .spike_induced_reset().exactly(0, 1, 2)
            .reset().exactly(0, 1, 2)
            .build())
        
        matches = apply_pattern(pattern, self.result)
        assert matches == []
        
        all_matches = apply_pattern_to_multiple(pattern, [self.result])
        assert all_matches[0] == []
        
        analysis = analyze_pattern_across_results(pattern, [self.result])
        assert analysis['total_matches'] == 0
        assert analysis['matches_per_result'] == [0]
    
    def test_apply_pattern_single_result_in_list(self):
        """Test applying pattern to list with single result."""
        pattern = create_pattern().spike().any_neurons().build()
        
        all_matches = apply_pattern_to_multiple(pattern, [self.result])
        
        assert len(all_matches) == 1
        assert 0 in all_matches
        assert isinstance(all_matches[0], list)
    
    def test_pattern_consistency_across_applications(self):
        """Test that same pattern gives consistent results when applied multiple times."""
        pattern = create_pattern().spike().any_neurons().build()
        
        # Apply pattern multiple ways
        matches1 = apply_pattern(pattern, self.result)
        matches2 = self.result.apply_external_pattern(pattern)
        matches3 = apply_pattern_to_multiple(pattern, [self.result])[0]
        
        # All should give same results
        assert len(matches1) == len(matches2) == len(matches3)
        
        # Compare match details
        for m1, m2, m3 in zip(matches1, matches2, matches3):
            assert m1['start_time'] == m2['start_time'] == m3['start_time']
            assert m1['end_time'] == m2['end_time'] == m3['end_time']

class TestStandalonePatternIntegration:
    """Integration tests for standalone patterns with real simulation scenarios."""
    
    def setup_method(self):
        """Set up realistic test scenarios."""
        self.sim = NetworkSimulation(auto_compile=True)
        
        # Create results with different parameters
        self.weak_coupling = self.sim.run_simulation(N=4, Tmax=50.0, strength=0.01, seed=42)
        self.strong_coupling = self.sim.run_simulation(N=4, Tmax=50.0, strength=0.1, seed=42)
        self.different_delay = self.sim.run_simulation(N=4, Tmax=50.0, delay=3.0, seed=42)
        
        self.all_results = [self.weak_coupling, self.strong_coupling, self.different_delay]
    
    def test_parameter_effect_analysis(self):
        """Test analyzing how parameters affect pattern occurrence."""
        # Simple spike pattern
        spike_pattern = create_pattern().spike().any_neurons().build()
        
        # Complex interaction pattern
        interaction_pattern = (create_pattern()
            .spike().any_neurons()
            .spike_induced_reset().any_neurons()
            .build())
        
        # Analyze both patterns across different parameter regimes
        spike_analysis = analyze_pattern_across_results(spike_pattern, self.all_results)
        interaction_analysis = analyze_pattern_across_results(interaction_pattern, self.all_results)
        
        # Should find some occurrences in all simulations
        assert spike_analysis['total_matches'] > 0
        assert len(spike_analysis['matches_per_result']) == 3
        
        # Interaction patterns might vary more between parameter regimes
        assert len(interaction_analysis['matches_per_result']) == 3
    
    def test_comparative_pattern_analysis(self):
        """Test comparing different patterns across same results."""
        patterns = {
            'simple_spike': create_pattern().spike().any_neurons().build(),
            'spike_reset': create_pattern().spike().any_neurons().reset().any_neurons().build(),
            'complex': (create_pattern()
                .spike().groups(2)
                .spike_induced_reset().groups(1)
                .build())
        }
        
        # Analyze all patterns
        analyses = {}
        for name, pattern in patterns.items():
            analyses[name] = analyze_pattern_across_results(pattern, self.all_results)
        
        # All analyses should complete successfully
        for name, analysis in analyses.items():
            assert 'total_matches' in analysis
            assert len(analysis['matches_per_result']) == len(self.all_results)
        
        # Simple spike pattern should generally find more matches
        assert analyses['simple_spike']['total_matches'] >= analyses['complex']['total_matches']
    
    def test_time_evolution_analysis(self):
        """Test analyzing pattern evolution over time."""
        pattern = create_pattern().spike().any_neurons().build()
        
        # Analyze in different time windows
        early_matches = apply_pattern_to_multiple(pattern, self.all_results, 
                                                 start_time=0.0, end_time=15.0)
        late_matches = apply_pattern_to_multiple(pattern, self.all_results, 
                                                start_time=35.0, end_time=50.0)
        
        # Should find matches in both periods
        for i in range(len(self.all_results)):
            assert i in early_matches
            assert i in late_matches
            assert isinstance(early_matches[i], list)
            assert isinstance(late_matches[i], list)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])