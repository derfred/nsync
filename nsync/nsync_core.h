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
//   - event: string describing the event (e.g., "r\t01010" for reset event)
//   - context: user-provided context data
void run_network_core(struct Network *network, 
                     void (*on_timestep)(double time, double *phases, char *event, void *context),
                     void *context); 