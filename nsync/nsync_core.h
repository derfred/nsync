#pragma once

#include "nsync.h"
#include "bitmap.h"

// Core simulation functions (shared between different interfaces)
double time_to_reset(struct Network *network, int i);
double gf(struct Network *network, int i, double eps);
void build_bitmap(char * buffer, const Bitmap *bitmap, char klass);

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
                                       const Bitmap *spike_map, const Bitmap *reset_map, 
                                       const Bitmap *total_reset_map,
                                       void *context),
                     void *context); 