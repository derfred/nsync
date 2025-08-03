#!/usr/bin/env python3

import pytest
import numpy as np
from nsync import EventPattern, PatternQueryBuilder, PatternMatcher, SimulationResult

class TestEventPattern:
    """Test EventPattern class functionality."""
    
    def test_empty_pattern_raises_error(self):
        """Test that empty patterns raise ValueError."""
        with pytest.raises(ValueError, match="Pattern cannot be empty"):
            EventPattern([])
    
    def test_pattern_without_type_raises_error(self):
        """Test that patterns without 'type' field raise ValueError."""
        with pytest.raises(ValueError, match="Pattern step 0 must have 'type' field"):
            EventPattern([{'neurons': [1, 2]}])
    
    def test_valid_pattern_creation(self):
        """Test that valid patterns are created successfully."""
        pattern = EventPattern([
            {'type': 'spike', 'neurons': {'type': 'exact', 'ids': [1, 2]}},
            {'type': 'reset', 'neurons': {'type': 'groups', 'sizes': [2]}}
        ])
        assert len(pattern.steps) == 2
        assert pattern.steps[0]['type'] == 'spike'
        assert pattern.steps[1]['type'] == 'reset'

class TestPatternQueryBuilder:
    """Test PatternQueryBuilder fluent interface."""
    
    def test_basic_event_types(self):
        """Test basic event type methods."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().reset().spike_induced_reset().build()
        
        assert len(pattern.steps) == 3
        assert pattern.steps[0]['type'] == 'spike'
        assert pattern.steps[1]['type'] == 'reset'
        assert pattern.steps[2]['type'] == 'spike_induced_reset'
    
    def test_exact_neuron_specification(self):
        """Test exact neuron ID specification."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().exactly(1, 3, 5).build()
        
        assert len(pattern.steps) == 1
        assert pattern.steps[0]['neurons']['type'] == 'exact'
        assert pattern.steps[0]['neurons']['ids'] == [1, 3, 5]
    
    def test_group_specification(self):
        """Test group-based neuron specification."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().groups(2, 1).build()
        
        assert len(pattern.steps) == 1
        assert pattern.steps[0]['neurons']['type'] == 'groups'
        assert pattern.steps[0]['neurons']['sizes'] == [2, 1]
    
    def test_count_specification(self):
        """Test count-based neuron specification."""
        builder = PatternQueryBuilder()
        pattern = builder.reset().count(3).build()
        
        assert len(pattern.steps) == 1
        assert pattern.steps[0]['neurons']['type'] == 'count'
        assert pattern.steps[0]['neurons']['value'] == 3
    
    def test_same_as_reference(self):
        """Test same_as reference specification."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().exactly(1, 2).reset().same_as(0).build()
        
        assert len(pattern.steps) == 2
        assert pattern.steps[1]['neurons']['type'] == 'reference'
        assert pattern.steps[1]['neurons']['step'] == 0
    
    def test_any_neurons(self):
        """Test any_neurons specification."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().any_neurons().build()
        
        assert len(pattern.steps) == 1
        assert pattern.steps[0]['neurons']['type'] == 'any'
    
    def test_wildcard_anything(self):
        """Test wildcard anything specification."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().anything().reset().build()
        
        assert len(pattern.steps) == 3
        assert pattern.steps[1]['type'] == 'wildcard'
    
    def test_error_on_neuron_spec_without_event_type(self):
        """Test that neuron specification without event type raises error."""
        builder = PatternQueryBuilder()
        with pytest.raises(ValueError, match="Must specify event type before neuron specification"):
            builder.exactly(1, 2)

class TestPatternMatcher:
    """Test PatternMatcher functionality."""
    
    def setup_method(self):
        """Set up test data for each test."""
        self.events = [
            {'time': 1.0, 'type': 'spike', 'neurons': [1, 3]},
            {'time': 1.0, 'type': 'spike_induced_reset', 'neurons': [0]},
            {'time': 2.0, 'type': 'reset', 'neurons': [1, 3]},
            {'time': 3.0, 'type': 'spike', 'neurons': [2, 4]},
            {'time': 3.0, 'type': 'spike_induced_reset', 'neurons': [1, 3]},
            {'time': 4.0, 'type': 'spike', 'neurons': [0]},
            {'time': 5.0, 'type': 'reset', 'neurons': [2, 4]},
        ]
        self.matcher = PatternMatcher()
    
    def test_exact_pattern_matching(self):
        """Test exact neuron pattern matching."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().exactly(1, 3).spike_induced_reset().exactly(0).build()
        
        matches = self.matcher.find_matches(self.events, pattern)
        
        assert len(matches) == 1
        assert matches[0]['start_index'] == 0
        assert matches[0]['end_index'] == 1
        assert len(matches[0]['matched_events']) == 2
    
    def test_group_pattern_matching(self):
        """Test group-based pattern matching."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().groups(2).spike_induced_reset().groups(1).build()
        
        matches = self.matcher.find_matches(self.events, pattern)
        
        # Should match multiple patterns with different neuron identities
        assert len(matches) >= 1
        
        # Check first match
        match = matches[0]
        assert len(match['matched_events']) == 2
        assert len(match['matched_events'][0]['neurons']) == 2  # 2 neurons in spike
        assert len(match['matched_events'][1]['neurons']) == 1  # 1 neuron in spike_induced_reset
    
    def test_reference_pattern_matching(self):
        """Test reference-based pattern matching."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().exactly(1, 3).reset().same_as(0).build()
        
        matches = self.matcher.find_matches(self.events, pattern)
        
        assert len(matches) == 1
        match = matches[0]
        assert match['matched_events'][0]['neurons'] == [1, 3]
        assert match['matched_events'][1]['neurons'] == [1, 3]
    
    def test_wildcard_pattern_matching(self):
        """Test wildcard pattern matching."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().anything().reset().build()
        
        matches = self.matcher.find_matches(self.events, pattern)
        
        assert len(matches) >= 1
        # Each match should have exactly 3 events (spike, anything, reset)
        for match in matches:
            assert len(match['matched_events']) == 3
    
    def test_time_window_filtering(self):
        """Test time window filtering."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().any_neurons().build()
        
        # Test with time window
        matches = self.matcher.find_matches(self.events, pattern, start_time=2.5, end_time=4.5)
        
        # Should only find spikes in the time window
        for match in matches:
            assert 2.5 <= match['start_time'] <= 4.5
    
    def test_count_pattern_matching(self):
        """Test count-based pattern matching."""
        builder = PatternQueryBuilder()
        pattern = builder.spike().count(2).build()
        
        matches = self.matcher.find_matches(self.events, pattern)
        
        # Should match all spike events with exactly 2 neurons
        for match in matches:
            assert len(match['matched_events'][0]['neurons']) == 2

class TestSimulationResult:
    """Test SimulationResult class functionality."""
    
    def setup_method(self):
        """Set up test data."""
        self.times = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        self.phases = np.random.rand(5, 3)  # 5 timesteps, 3 neurons
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
            'initial_phases': None
        }
        self.result = SimulationResult(self.times, self.phases, self.events, self.parameters)
    
    def test_query_events_returns_builder(self):
        """Test that query_events returns a PatternQueryBuilder."""
        builder = self.result.query_events()
        assert isinstance(builder, PatternQueryBuilder)
    
    def test_find_patterns(self):
        """Test find_patterns method."""
        pattern = self.result.query_events().spike().any_neurons().build()
        matches = self.result.find_patterns(pattern)
        
        assert len(matches) >= 1
        # Should find at least the spike events in our test data
        spike_events = [e for e in self.events if e['type'] == 'spike']
        assert len(matches) >= len(spike_events)
    
    def test_analyze_pattern_statistics(self):
        """Test pattern statistics analysis."""
        pattern = self.result.query_events().spike().any_neurons().build()
        stats = self.result.analyze_pattern_statistics(pattern)
        
        assert 'count' in stats
        assert 'matches' in stats
        assert 'inter_match_intervals' in stats
        assert 'pattern_durations' in stats
        assert stats['count'] >= 0
    
    def test_get_spikes(self):
        """Test spike extraction."""
        spikes = self.result.get_spikes()
        
        assert isinstance(spikes, dict)
        assert len(spikes) == 3  # 3 neurons
        
        # Check that reset events are included as spikes
        assert 1.0 in spikes[0] or 2.0 in spikes[0]  # neuron 0 reset times
        assert 1.0 in spikes[1] or 2.0 in spikes[1]  # neuron 1 reset times
    
    def test_get_detailed_events(self):
        """Test detailed event extraction."""
        detailed = self.result.get_detailed_events()
        
        assert 'spikes' in detailed
        assert 'natural_resets' in detailed
        assert 'spike_induced_resets' in detailed
        
        # Check that events are properly categorized
        assert len(detailed['spikes']) >= 1
        assert len(detailed['natural_resets']) >= 1
        assert len(detailed['spike_induced_resets']) >= 1

class TestIntegration:
    """Integration tests for the complete pattern matching system."""
    
    def test_complex_pattern_from_user_example(self):
        """Test the complex pattern from the user's example."""
        # Simulate events similar to user's example
        events = [
            {'time': 95.0, 'type': 'reset', 'neurons': [1, 3]},
            {'time': 95.4, 'type': 'spike', 'neurons': [2, 4]},
            {'time': 95.4, 'type': 'spike_induced_reset', 'neurons': [0]},
            {'time': 96.7, 'type': 'spike', 'neurons': [1, 3]},
            {'time': 96.7, 'type': 'spike_induced_reset', 'neurons': [2, 4]},
            {'time': 97.0, 'type': 'spike', 'neurons': [0]},
            {'time': 97.9, 'type': 'reset', 'neurons': [1, 3]},
        ]
        
        times = np.array([95.0, 95.4, 96.7, 97.0, 97.9])
        phases = np.random.rand(5, 5)  # 5 timesteps, 5 neurons
        parameters = {'N': 5, 'Tmax': 100.0}
        
        result = SimulationResult(times, phases, events, parameters)
        
        # Test exact pattern matching
        pattern = (result.query_events()
                  .reset().exactly(1, 3)
                  .spike().exactly(2, 4)
                  .spike_induced_reset().exactly(0)
                  .spike().same_as(0)  # same as reset
                  .spike_induced_reset().same_as(1)  # same as first spike
                  .spike().same_as(2)  # same as spike_induced_reset
                  .reset().same_as(0)  # same as first reset
                  .build())
        
        matches = result.find_patterns(pattern)
        assert len(matches) == 1
        
        match = matches[0]
        assert len(match['matched_events']) == 7
        assert match['start_time'] == 95.0
        assert match['end_time'] == 97.9
    
    def test_permutation_invariant_pattern(self):
        """Test permutation-invariant pattern matching."""
        events = [
            {'time': 94.5, 'type': 'spike', 'neurons': [4]},
            {'time': 94.5, 'type': 'spike_induced_reset', 'neurons': [0, 3]},
            {'time': 95.3, 'type': 'spike', 'neurons': [1, 2]},
            {'time': 95.3, 'type': 'spike_induced_reset', 'neurons': [4]},
            {'time': 96.1, 'type': 'spike', 'neurons': [0, 3]},
            {'time': 96.1, 'type': 'spike_induced_reset', 'neurons': [1, 2]},
            {'time': 96.9, 'type': 'spike', 'neurons': [4]},
        ]
        
        times = np.array([94.5, 95.3, 96.1, 96.9])
        phases = np.random.rand(4, 5)
        parameters = {'N': 5, 'Tmax': 100.0}
        
        result = SimulationResult(times, phases, events, parameters)
        
        # Test group-based pattern (permutation invariant)
        pattern = (result.query_events()
                  .spike().groups(1)
                  .spike_induced_reset().groups(2)
                  .spike().groups(2)
                  .spike_induced_reset().groups(1)
                  .spike().groups(2)
                  .spike_induced_reset().groups(2)
                  .spike().groups(1)
                  .build())
        
        matches = result.find_patterns(pattern)
        assert len(matches) == 1
        
        match = matches[0]
        assert len(match['matched_events']) == 7

if __name__ == "__main__":
    pytest.main([__file__, "-v"])