#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <unistd.h>
#include <string.h>

#include "nsync.h"
#include "nsync_core.h"

// Structure to hold simulation results
struct SimulationResult {
    double *times;
    double *phases_data;  // flattened array: phases[time_step * N + neuron_id]
    int *spike_maps;      // array of spike bitmaps for each timestep
    int *reset_maps;      // array of natural reset bitmaps for each timestep  
    int *total_reset_maps; // array of total reset bitmaps for each timestep
    int num_timesteps;
    int N;
    int capacity;
};

// Initialize result structure
struct SimulationResult* init_simulation_result(int N, int initial_capacity) {
    struct SimulationResult *result = malloc(sizeof(struct SimulationResult));
    result->N = N;
    result->capacity = initial_capacity;
    result->num_timesteps = 0;
    result->times = malloc(sizeof(double) * initial_capacity);
    result->phases_data = malloc(sizeof(double) * initial_capacity * N);
    result->spike_maps = malloc(sizeof(int) * initial_capacity);
    result->reset_maps = malloc(sizeof(int) * initial_capacity);
    result->total_reset_maps = malloc(sizeof(int) * initial_capacity);
    return result;
}

// Resize result arrays if needed
void resize_simulation_result(struct SimulationResult *result) {
    if (result->num_timesteps >= result->capacity) {
        result->capacity *= 2;
        result->times = realloc(result->times, sizeof(double) * result->capacity);
        result->phases_data = realloc(result->phases_data, sizeof(double) * result->capacity * result->N);
        result->spike_maps = realloc(result->spike_maps, sizeof(int) * result->capacity);
        result->reset_maps = realloc(result->reset_maps, sizeof(int) * result->capacity);
        result->total_reset_maps = realloc(result->total_reset_maps, sizeof(int) * result->capacity);
    }
}

// Add a timestep to results
void add_timestep(struct SimulationResult *result, double time, double *phases, 
                 int spike_map, int reset_map, int total_reset_map) {
    resize_simulation_result(result);
    
    int idx = result->num_timesteps;
    result->times[idx] = time;
    
    // Copy phases
    for (int i = 0; i < result->N; i++) {
        result->phases_data[idx * result->N + i] = phases[i];
    }
    
    // Store bitmap data
    result->spike_maps[idx] = spike_map;
    result->reset_maps[idx] = reset_map;
    result->total_reset_maps[idx] = total_reset_map;
    
    result->num_timesteps++;
}

// Free result structure
void free_simulation_result(struct SimulationResult *result) {
    if (result) {
        free(result->times);
        free(result->phases_data);
        free(result->spike_maps);
        free(result->reset_maps);
        free(result->total_reset_maps);
        free(result);
    }
}

// Initialize network with parameters and optional initial phases
void init_network(struct Network *network, int N, double Tmax, double delay, 
                  double strength, double I, double Ijitter, unsigned int seed, 
                  double *initial_phases) {
    srand(seed);
    
    network->now = 0;
    network->N = N;
    network->Tmax = Tmax;
    network->delay = delay;
    network->strength = strength;
    network->Ijitter = Ijitter;
    network->currents = (double *) malloc(sizeof(double) * N);
    network->periods = (double *) malloc(sizeof(double) * N);
    network->phases = (double *) malloc(sizeof(double) * N);
    network->resets = (double *) malloc(sizeof(double) * N);

    for (int i = 0; i < N; i++) {
        network->currents[i] = I + i * Ijitter;
        network->periods[i] = log(network->currents[i]/(network->currents[i] - 1));
        network->resets[i] = -1;
        
        // Use provided initial phases or generate random ones
        if (initial_phases != NULL) {
            network->phases[i] = initial_phases[i];
        } else {
            network->phases[i] = (double) rand() / RAND_MAX;
        }
    }
}

// Free network memory
void free_network(struct Network *network) {
    if (network) {
        free(network->currents);
        free(network->periods);
        free(network->phases);
        free(network->resets);
    }
}

// Callback function for capturing timestep data
void capture_timestep_callback(double time, double *phases, 
                              int spike_map, int reset_map, int total_reset_map,
                              void *context) {
    struct SimulationResult *result = (struct SimulationResult *)context;
    add_timestep(result, time, phases, spike_map, reset_map, total_reset_map);
}

// Run simulation and capture results
struct SimulationResult* run_network_simulation(struct Network *network) {
    struct SimulationResult *result = init_simulation_result(network->N, 1000);
    
    // Use the shared core simulation with capture callback
    run_network_core(network, capture_timestep_callback, result);
    
    return result;
} 