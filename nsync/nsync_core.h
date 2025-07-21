#pragma once

#include "nsync.h"

// Core simulation functions (shared between different interfaces)
double time_to_reset(struct Network *network, int i);
double gf(struct Network *network, int i, double eps);
void build_bitmap(char * buffer, int bitmap, int N, char klass);

// Unified simulation core with callback for output handling
// on_timestep: callback function called for each simulation timestep
//   - time: current simulation time
//   - phases: array of current phases for all neurons
//   - spike_map: bitmap of neurons that spiked this timestep
//   - reset_map: bitmap of neurons that reset due to natural timing
//   - total_reset_map: bitmap of all neurons that reset (natural + spike-induced)
//   - context: user-provided context data
void run_network_core(struct Network *network, 
                     void (*on_timestep)(double time, double *phases, 
                                       int spike_map, int reset_map, int total_reset_map,
                                       void *context),
                     void *context); 