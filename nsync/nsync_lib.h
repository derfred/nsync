#pragma once

#include "nsync.h"
#include "bitmap.h"

// Structure to hold simulation results
struct SimulationResult {
    double *times;
    double *phases_data;  // flattened array: phases[time_step * N + neuron_id]
    Bitmap **spike_maps;      // array of spike bitmaps for each timestep
    Bitmap **reset_maps;      // array of natural reset bitmaps for each timestep  
    Bitmap **total_reset_maps; // array of total reset bitmaps for each timestep
    int num_timesteps;
    int N;
    int capacity;
};

// Library functions for Python interface
void init_network(struct Network *network, int N, double Tmax, double delay, 
                  double strength, double I, double Ijitter, unsigned int seed, 
                  double *initial_phases);
void free_network(struct Network *network);
struct SimulationResult* run_network_simulation(struct Network *network);
void free_simulation_result(struct SimulationResult *result);

// Export functions for accessing bitmap data from Python
int* get_spike_neurons(struct SimulationResult *result, int timestep, int *count);
int* get_reset_neurons(struct SimulationResult *result, int timestep, int *count);
int* get_total_reset_neurons(struct SimulationResult *result, int timestep, int *count); 