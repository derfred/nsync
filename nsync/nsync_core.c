#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#include "nsync_core.h"

double time_to_reset(struct Network *network, int i) {
  return (1 - network->phases[i]) * network->periods[i];
}

double gf(struct Network *network, int i, double eps) {
  double V = network->currents[i] * (1 - exp(-1 * network->periods[i] * network->phases[i])) + eps;

  if (V > 1) {
    return 1;
  } else {
    return -log(1 - V/network->currents[i]) / network->periods[i];
  }
}

void build_bitmap(char * buffer, const Bitmap *bitmap, char klass) {
  bitmap_to_string(buffer, bitmap, klass);
}

// Unified simulation core that accepts callbacks for output handling
void run_network_core(struct Network *network, 
                     void (*on_timestep)(double time, double *phases, 
                                       const Bitmap *spike_map, const Bitmap *reset_map, 
                                       const Bitmap *total_reset_map,
                                       void *context),
                     void *context) {
  const int suffix_size = network->N + 2 + 1;
  char * suffix = (char *) malloc(sizeof(char) * suffix_size);

  // Create bitmaps for tracking neuron states
  Bitmap *reset_map = bitmap_create(network->N);
  Bitmap *spike_map = bitmap_create(network->N);
  Bitmap *total_reset_map = bitmap_create(network->N);

  while (network->now < network->Tmax) {
    double next_reset = network->Tmax;
    bitmap_clear(reset_map);

    double next_spike = network->Tmax;
    bitmap_clear(spike_map);

    // 1. find time to next event, and determine type of event
    for (int i = 0; i < network->N; i++) {
      double _next_reset = network->now + time_to_reset(network, i);
      if (_next_reset < next_reset) {
        next_reset = _next_reset;
        bitmap_clear(reset_map);
        bitmap_set(reset_map, i);
      } else if (_next_reset == next_reset) {
        bitmap_set(reset_map, i);
      }

      if (network->resets[i] > 0) {
        double _next_spike = network->resets[i] + network->delay;
        if (_next_spike > network->now) {
          if (_next_spike < next_spike) {
            next_spike = _next_spike;
            bitmap_clear(spike_map);
            bitmap_set(spike_map, i);
          } else if (_next_spike == next_spike) {
            bitmap_set(spike_map, i);
          }
        }
      }
    }

    // 2. advance phases
    double _now = fmin(next_reset, next_spike);
    double dt   = _now - network->now;
    for (int i = 0; i < network->N; i++) {
      network->phases[i] += dt / network->periods[i];
    }

    bitmap_clear(total_reset_map);
    if (next_reset < next_spike) {
      // 3.a. if reset -> issue spikes
      for (int i = 0; i < network->N; i++) {
        if (bitmap_test(reset_map, i)) {
          network->resets[i] = _now;
          network->phases[i] = 0;
          bitmap_set(total_reset_map, i);
        }
      }
      // No spikes occurred, so spike_map should be cleared
      bitmap_clear(spike_map);
    } else {
      // 3.b. if spike -> jump phases, reset if necessary
      for (int i = 0; i < network->N; i++) {
        double eps = 0;
        for (int j = 0; j < network->N; j++) {
          if (i != j) {
            if (bitmap_test(spike_map, j)) {
              eps += network->strength;
            }
          }
        }
        if (eps > 0) {
          network->phases[i] = gf(network, i, eps);
        }
        if (network->phases[i] >= 1) {
          bitmap_set(total_reset_map, i);
          network->resets[i] = _now;
          network->phases[i] = 0;
        }
      }
      // No natural resets occurred, so reset_map should be cleared
      bitmap_clear(reset_map);
    }
    network->now = _now;
    
    // Call the output handler callback with bitmap information
    if (on_timestep) {
      on_timestep(network->now, network->phases, spike_map, reset_map, total_reset_map, context);
    }
  }
  
  // Cleanup
  bitmap_free(reset_map);
  bitmap_free(spike_map);
  bitmap_free(total_reset_map);
  free(suffix);
} 