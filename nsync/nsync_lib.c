#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <unistd.h>
#include <string.h>

#include "nsync.h"
#include "nsync_core.h"
#include "nsync_lib.h"
#include "bitmap_interface.h"

// Forward declaration - full definition in nsync_lib.h

// Initialize result structure
struct SimulationResult* init_simulation_result(int N, int initial_capacity) {
    struct SimulationResult *result = malloc(sizeof(struct SimulationResult));
    result->N = N;
    result->capacity = initial_capacity;
    result->num_timesteps = 0;
    result->times = malloc(sizeof(double) * initial_capacity);
    result->phases_data = malloc(sizeof(double) * initial_capacity * N);
    result->spike_maps = malloc(sizeof(Bitmap*) * initial_capacity);
    result->reset_maps = malloc(sizeof(Bitmap*) * initial_capacity);
    result->total_reset_maps = malloc(sizeof(Bitmap*) * initial_capacity);
    
    // Initialize bitmap pointers
    for (int i = 0; i < initial_capacity; i++) {
        result->spike_maps[i] = NULL;
        result->reset_maps[i] = NULL;
        result->total_reset_maps[i] = NULL;
    }
    return result;
}

// Resize result arrays if needed
void resize_simulation_result(struct SimulationResult *result) {
    if (result->num_timesteps >= result->capacity) {
        result->capacity *= 2;
        result->times = realloc(result->times, sizeof(double) * result->capacity);
        result->phases_data = realloc(result->phases_data, sizeof(double) * result->capacity * result->N);
        result->spike_maps = realloc(result->spike_maps, sizeof(Bitmap*) * result->capacity);
        result->reset_maps = realloc(result->reset_maps, sizeof(Bitmap*) * result->capacity);
        result->total_reset_maps = realloc(result->total_reset_maps, sizeof(Bitmap*) * result->capacity);
        
        // Initialize new bitmap pointers
        for (int i = result->num_timesteps; i < result->capacity; i++) {
            result->spike_maps[i] = NULL;
            result->reset_maps[i] = NULL;
            result->total_reset_maps[i] = NULL;
        }
    }
}

// Add a timestep to results
void add_timestep(struct SimulationResult *result, double time, double *phases, 
                 const Bitmap *spike_map, const Bitmap *reset_map, const Bitmap *total_reset_map) {
    resize_simulation_result(result);
    
    int idx = result->num_timesteps;
    result->times[idx] = time;
    
    // Copy phases
    for (int i = 0; i < result->N; i++) {
        result->phases_data[idx * result->N + i] = phases[i];
    }
    
    // Store bitmap data (create copies)
    result->spike_maps[idx] = bitmap_create(result->N);
    bitmap_copy(result->spike_maps[idx], spike_map);
    
    result->reset_maps[idx] = bitmap_create(result->N);
    bitmap_copy(result->reset_maps[idx], reset_map);
    
    result->total_reset_maps[idx] = bitmap_create(result->N);
    bitmap_copy(result->total_reset_maps[idx], total_reset_map);
    
    result->num_timesteps++;
}

// Free result structure
void free_simulation_result(struct SimulationResult *result) {
    if (result) {
        free(result->times);
        free(result->phases_data);
        
        // Free individual bitmaps
        for (int i = 0; i < result->num_timesteps; i++) {
            if (result->spike_maps[i]) bitmap_free(result->spike_maps[i]);
            if (result->reset_maps[i]) bitmap_free(result->reset_maps[i]);
            if (result->total_reset_maps[i]) bitmap_free(result->total_reset_maps[i]);
        }
        
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
                              const Bitmap *spike_map, const Bitmap *reset_map, 
                              const Bitmap *total_reset_map,
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

// Export functions for Python access to bitmap data
// Get spike neurons for a specific timestep
int* get_spike_neurons(struct SimulationResult *result, int timestep, int *count) {
    if (timestep < 0 || timestep >= result->num_timesteps) {
        *count = 0;
        return NULL;
    }
    return bitmap_to_indices(result->spike_maps[timestep], count);
}

// Get reset neurons for a specific timestep
int* get_reset_neurons(struct SimulationResult *result, int timestep, int *count) {
    if (timestep < 0 || timestep >= result->num_timesteps) {
        *count = 0;
        return NULL;
    }
    return bitmap_to_indices(result->reset_maps[timestep], count);
}

// Get total reset neurons for a specific timestep
int* get_total_reset_neurons(struct SimulationResult *result, int timestep, int *count) {
    if (timestep < 0 || timestep >= result->num_timesteps) {
        *count = 0;
        return NULL;
    }
    return bitmap_to_indices(result->total_reset_maps[timestep], count);
} 