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

void build_bitmap(char * buffer, int bitmap, int N, char klass) {
  buffer[0] = klass;
  buffer[1] = '\t';
  for (int i = 0; i < N; i++) {
    buffer[i + 2] = (bitmap & (1 << i)) > 0 ? '1' : '0';
  }
  buffer[N + 2] = '\0';
}

// Unified simulation core that accepts callbacks for output handling
void run_network_core(struct Network *network, 
                     void (*on_timestep)(double time, double *phases, 
                                       int spike_map, int reset_map, int total_reset_map,
                                       void *context),
                     void *context) {
  const int suffix_size = network->N + 2 + 1;
  char * suffix = (char *) malloc(sizeof(char) * suffix_size);

  while (network->now < network->Tmax) {
    double next_reset = network->Tmax;
    int reset_map     = 0;

    double next_spike = network->Tmax;
    int spike_map     = 0;

    // 1. find time to next event, and determine type of event
    for (int i = 0; i < network->N; i++) {
      double _next_reset = network->now + time_to_reset(network, i);
      if (_next_reset < next_reset) {
        next_reset = _next_reset;
        reset_map = 1 << i;
      } else if (_next_reset == next_reset) {
        reset_map |= 1 << i;
      }

      if (network->resets[i] > 0) {
        double _next_spike = network->resets[i] + network->delay;
        if (_next_spike > network->now) {
          if (_next_spike < next_spike) {
            next_spike = _next_spike;
            spike_map = 1 << i;
          } else if (_next_spike == next_spike) {
            spike_map |= 1 << i;
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

    int total_reset_map = 0;
    if (next_reset < next_spike) {
      // 3.a. if reset -> issue spikes
      for (int i = 0; i < network->N; i++) {
        if (reset_map & (1 << i)) {
          network->resets[i] = _now;
          network->phases[i] = 0;
          total_reset_map |= 1 << i;
        }
      }
      // No spikes occurred, so spike_map should be 0
      spike_map = 0;
    } else {
      // 3.b. if spike -> jump phases, reset if necessary
      for (int i = 0; i < network->N; i++) {
        double eps = 0;
        for (int j = 0; j < network->N; j++) {
          if (i != j) {
            if (spike_map & (1 << j)) {
              eps += network->strength;
            }
          }
        }
        if (eps > 0) {
          network->phases[i] = gf(network, i, eps);
        }
        if (network->phases[i] >= 1) {
          total_reset_map |= 1 << i;
          network->resets[i] = _now;
          network->phases[i] = 0;
        }
      }
      // No natural resets occurred, so reset_map should be 0
      reset_map = 0;
    }
    network->now = _now;
    
    // Call the output handler callback with bitmap information
    if (on_timestep) {
      on_timestep(network->now, network->phases, spike_map, reset_map, total_reset_map, context);
    }
  }
  
  free(suffix);
} 