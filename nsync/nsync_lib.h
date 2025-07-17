#pragma once

#include "nsync.h"

// Structure to hold simulation results
struct SimulationResult {
    double *times;
    double *phases_data;  // flattened array: phases[time_step * N + neuron_id]
    char *events_data;    // flattened array: events[time_step * (N+3)]
    int num_timesteps;
    int N;
    int capacity;
};

// Library functions for Python interface
void init_network_with_params(struct Network *network, int N, double Tmax, double delay, 
                             double strength, double I, double Ijitter, unsigned int seed);
void free_network(struct Network *network);
struct SimulationResult* run_network_simulation(struct Network *network);
void free_simulation_result(struct SimulationResult *result); 