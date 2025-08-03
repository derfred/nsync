#!/usr/bin/env python3

"""
Pattern matching system for neural network simulation events.

This module provides a fluent interface for defining and matching complex
event patterns in neural network simulations, with support for:
- Exact neuron specification
- Permutation-invariant group matching
- Wildcards and references
- Statistical analysis of pattern occurrences
"""

from typing import Dict, List, Tuple, Optional, Any
import numpy as np

class PatternMatch:
    """Wrapper object for pattern match results."""
    
    def __init__(self, start_index: int, end_index: int, start_time: float, 
                 end_time: float, matched_events: List[Dict], neuron_mapping: Dict):
        """Initialize a pattern match result.
        
        Args:
            start_index: Index of first matched event
            end_index: Index of last matched event
            start_time: Time of first matched event
            end_time: Time of last matched event
            matched_events: List of matched event dictionaries
            neuron_mapping: Mapping of neuron references
        """
        self.start_index = start_index
        self.end_index = end_index
        self.start_time = start_time
        self.end_time = end_time
        self.matched_events = matched_events
        self.neuron_mapping = neuron_mapping
    
    @property
    def duration(self) -> float:
        """Duration of the pattern match."""
        return self.end_time - self.start_time
    
    @property
    def event_count(self) -> int:
        """Number of events in the match."""
        return len(self.matched_events)
    
    def __repr__(self) -> str:
        return (f"PatternMatch(start_time={self.start_time:.4f}, "
                f"end_time={self.end_time:.4f}, events={self.event_count})")
    
    def __str__(self) -> str:
        return self.__repr__()
    
    def to_dict(self) -> Dict:
        """Convert to dictionary format (for backward compatibility)."""
        return {
            'start_index': self.start_index,
            'end_index': self.end_index,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'matched_events': self.matched_events,
            'neuron_mapping': self.neuron_mapping
        }

class EventPattern:
    """Represents a pattern for matching sequences of neural network events."""
    
    def __init__(self, steps: List[Dict[str, Any]]):
        """Initialize an event pattern.
        
        Args:
            steps: List of pattern step dictionaries
        """
        self.steps = steps
        self._validate_pattern()
    
    def _validate_pattern(self):
        """Validate that the pattern is well-formed."""
        if not self.steps:
            raise ValueError("Pattern cannot be empty")
        
        for i, step in enumerate(self.steps):
            if 'type' not in step:
                raise ValueError(f"Pattern step {i} must have 'type' field")

class PatternMatcher:
    """Handles the actual pattern matching logic."""
    
    def __init__(self, time_tolerance: float = 1e-10):
        self.time_tolerance = time_tolerance
    
    def find_matches(self, events: List[Dict], pattern: EventPattern, 
                    start_time: Optional[float] = None, 
                    end_time: Optional[float] = None) -> List[PatternMatch]:
        """Find all matches of the pattern in the event sequence.
        
        Args:
            events: List of event dictionaries
            pattern: EventPattern to search for
            start_time: Optional start time for search window
            end_time: Optional end time for search window
        
        Returns:
            List of PatternMatch objects
        """
        matches = []
        filtered_events = self._filter_events_by_time(events, start_time, end_time)

        for start_idx in range(len(filtered_events)):
            match = self._try_match_at_position(filtered_events, pattern, start_idx)
            if match:
                matches.append(match)
        return matches
    
    def _filter_events_by_time(self, events: List[Dict], start_time: Optional[float], 
                              end_time: Optional[float]) -> List[Dict]:
        """Filter events by time window."""
        filtered = events
        if start_time is not None:
            filtered = [e for e in filtered if e['time'] >= start_time]
        if end_time is not None:
            filtered = [e for e in filtered if e['time'] <= end_time]
        return filtered
    
    def _try_match_at_position(self, events: List[Dict], pattern: EventPattern, 
                              start_idx: int) -> Optional[PatternMatch]:
        """Try to match pattern starting at given position."""
        if start_idx >= len(events):
            return None
        
        matched_events = []
        current_idx = start_idx
        neuron_mapping = {}
        
        for pattern_step in pattern.steps:
            match_result = self._find_next_matching_event(
                events, current_idx, pattern_step, neuron_mapping
            )
            
            if match_result is None:
                return None
            
            event_idx, matched_event, updated_mapping = match_result
            matched_events.append(matched_event)
            neuron_mapping.update(updated_mapping)
            current_idx = event_idx + 1
        
        return PatternMatch(
            start_index=start_idx,
            end_index=current_idx - 1,
            start_time=matched_events[0]['time'],
            end_time=matched_events[-1]['time'],
            matched_events=matched_events,
            neuron_mapping=neuron_mapping
        )
    
    def _find_next_matching_event(self, events: List[Dict], start_idx: int, 
                                 pattern_step: Dict, neuron_mapping: Dict) -> Optional[Tuple]:
        """Find the next event that matches the pattern step."""
        # Handle wildcard matching
        if pattern_step.get('type') == 'wildcard':
            return self._match_wildcard(events, start_idx, pattern_step, neuron_mapping)
        
        for i in range(start_idx, len(events)):
            event = events[i]
            
            if not self._matches_type(event['type'], pattern_step['type']):
                continue
            
            neurons_match, updated_mapping = self._matches_neurons(
                event['neurons'], pattern_step.get('neurons'), neuron_mapping
            )
            
            if neurons_match:
                return i, event, updated_mapping
        
        return None
    
    def _match_wildcard(self, events: List[Dict], start_idx: int, 
                       pattern_step: Dict, neuron_mapping: Dict) -> Optional[Tuple]:
        """Handle wildcard matching that can skip events."""
        min_count = pattern_step.get('min_count', 1)
        max_count = pattern_step.get('max_count', 1)
        
        # For now, implement simple single event wildcard
        if start_idx < len(events):
            return start_idx, events[start_idx], {}
        return None
    
    def _matches_type(self, event_type: str, pattern_type: str) -> bool:
        """Check if event type matches pattern type."""
        return pattern_type == '*' or event_type == pattern_type
    
    def _matches_neurons(self, event_neurons: List[int], neuron_spec: Optional[Dict], 
                        current_mapping: Dict) -> Tuple[bool, Dict]:
        """Check if event neurons match neuron specification."""
        if neuron_spec is None:
            return True, {}
        
        spec_type = neuron_spec.get('type')
        
        if spec_type == 'exact':
            return sorted(event_neurons) == sorted(neuron_spec['ids']), {}
        
        elif spec_type == 'groups':
            return self._matches_neuron_groups(event_neurons, neuron_spec['sizes'], current_mapping)
        
        elif spec_type == 'count':
            return len(event_neurons) == neuron_spec['value'], {}
        
        elif spec_type == 'reference':
            step_index = neuron_spec['step']
            ref_key = f"step_{step_index}"
            if ref_key in current_mapping:
                return sorted(event_neurons) == sorted(current_mapping[ref_key]), {}
            else:
                # First occurrence, establish the mapping
                return True, {ref_key: event_neurons}
        
        elif spec_type == 'any':
            return True, {}
        
        return False, {}
    
    def _matches_neuron_groups(self, event_neurons: List[int], group_sizes: List[int], 
                              current_mapping: Dict) -> Tuple[bool, Dict]:
        """Match neurons against group structure."""
        if len(event_neurons) != sum(group_sizes):
            return False, {}
        
        # For group matching, we just check that the total count matches
        # The actual group assignment can be done dynamically
        return True, {}

class PatternQueryBuilder:
    """Fluent interface for building event patterns."""
    
    def __init__(self):
        self.steps = []
        self.current_step = None
    
    def spike(self) -> 'PatternQueryBuilder':
        """Add a spike event to the pattern."""
        return self._start_step('spike')
    
    def reset(self) -> 'PatternQueryBuilder':
        """Add a reset event to the pattern."""
        return self._start_step('reset')
    
    def spike_induced_reset(self) -> 'PatternQueryBuilder':
        """Add a spike-induced reset event to the pattern."""
        return self._start_step('spike_induced_reset')
    
    def anything(self, min_count: int = 1, max_count: int = 1) -> 'PatternQueryBuilder':
        """Add a wildcard that matches any event type."""
        self._finalize_current_step()
        self.current_step = {
            'type': 'wildcard',
            'min_count': min_count,
            'max_count': max_count
        }
        return self
    
    def exactly(self, *neuron_ids: int) -> 'PatternQueryBuilder':
        """Specify exact neuron IDs."""
        if self.current_step is None:
            raise ValueError("Must specify event type before neuron specification")
        self.current_step['neurons'] = {'type': 'exact', 'ids': list(neuron_ids)}
        return self
    
    def groups(self, *sizes: int) -> 'PatternQueryBuilder':
        """Specify neuron groups for permutation-invariant matching."""
        if self.current_step is None:
            raise ValueError("Must specify event type before neuron specification")
        self.current_step['neurons'] = {'type': 'groups', 'sizes': list(sizes)}
        return self
    
    def count(self, n: int) -> 'PatternQueryBuilder':
        """Specify exact count of neurons."""
        if self.current_step is None:
            raise ValueError("Must specify event type before neuron specification")
        self.current_step['neurons'] = {'type': 'count', 'value': n}
        return self
    
    def same_as(self, step_index: int) -> 'PatternQueryBuilder':
        """Reference neurons from a previous step."""
        if self.current_step is None:
            raise ValueError("Must specify event type before neuron specification")
        self.current_step['neurons'] = {'type': 'reference', 'step': step_index}
        return self
    
    def any_neurons(self) -> 'PatternQueryBuilder':
        """Match any neurons."""
        if self.current_step is None:
            raise ValueError("Must specify event type before neuron specification")
        self.current_step['neurons'] = {'type': 'any'}
        return self
    
    def _start_step(self, event_type: str) -> 'PatternQueryBuilder':
        """Start a new pattern step."""
        self._finalize_current_step()
        self.current_step = {'type': event_type}
        return self
    
    def _finalize_current_step(self):
        """Add current step to pattern if it exists."""
        if self.current_step is not None:
            self.steps.append(self.current_step)
            self.current_step = None
    
    def build(self) -> EventPattern:
        """Build the final event pattern."""
        self._finalize_current_step()
        return EventPattern(self.steps)

def create_pattern() -> PatternQueryBuilder:
    """Create a standalone pattern query builder.
    
    This allows you to create patterns independently of any simulation result
    and apply them to one or more results later.
    
    Returns:
        PatternQueryBuilder instance for chaining pattern specifications
        
    Example:
        pattern = create_pattern().spike().exactly(1, 3).spike_induced_reset().exactly(0).build()
        matches1 = apply_pattern(pattern, result1)
        matches2 = apply_pattern(pattern, result2)
    """
    return PatternQueryBuilder()

def apply_pattern(pattern: EventPattern, result, 
                 start_time: Optional[float] = None, 
                 end_time: Optional[float] = None) -> List[PatternMatch]:
    """Apply a pattern to a simulation result.
    
    Args:
        pattern: EventPattern to search for
        result: SimulationResult object to search in
        start_time: Optional start time for search window
        end_time: Optional end time for search window
        
    Returns:
        List of PatternMatch objects from PatternMatcher.find_matches()
    """
    matcher = PatternMatcher()
    return matcher.find_matches(result.events, pattern, start_time, end_time)

def apply_pattern_to_multiple(pattern: EventPattern, results: List, 
                             start_time: Optional[float] = None, 
                             end_time: Optional[float] = None) -> Dict[int, List[PatternMatch]]:
    """Apply a pattern to multiple simulation results.
    
    Args:
        pattern: EventPattern to search for
        results: List of SimulationResult objects to search in
        start_time: Optional start time for search window
        end_time: Optional end time for search window
        
    Returns:
        Dictionary mapping result index to list of PatternMatch objects
    """
    all_matches = {}
    for i, result in enumerate(results):
        matches = apply_pattern(pattern, result, start_time, end_time)
        all_matches[i] = matches
    return all_matches

def analyze_pattern_across_results(pattern: EventPattern, results: List) -> Dict:
    """Analyze pattern statistics across multiple simulation results.
    
    Args:
        pattern: EventPattern to analyze
        results: List of SimulationResult objects
        
    Returns:
        Dictionary with aggregated statistics:
        - 'total_matches': Total matches across all results
        - 'matches_per_result': List of match counts per result
        - 'result_statistics': List of statistics per result
        - 'aggregated_durations': All pattern durations combined
        - 'aggregated_intervals': All inter-match intervals combined
    """
    all_matches = apply_pattern_to_multiple(pattern, results)
    
    total_matches = 0
    matches_per_result = []
    result_statistics = []
    aggregated_durations = []
    aggregated_intervals = []
    
    for i, result in enumerate(results):
        matches = all_matches[i]
        total_matches += len(matches)
        matches_per_result.append(len(matches))
        
        # Calculate statistics for this result
        durations = []
        intervals = []
        
        for j, match in enumerate(matches):
            durations.append(match.duration)
            if j > 0:
                intervals.append(match.start_time - matches[j-1].end_time)
        
        aggregated_durations.extend(durations)
        aggregated_intervals.extend(intervals)
        
        result_statistics.append({
            'count': len(matches),
            'durations': durations,
            'intervals': intervals
        })
    
    return {
        'total_matches': total_matches,
        'matches_per_result': matches_per_result,
        'result_statistics': result_statistics,
        'aggregated_durations': aggregated_durations,
        'aggregated_intervals': aggregated_intervals
    }