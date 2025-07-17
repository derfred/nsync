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
    char *events_data;    // flattened array: events[time_step * (N+3)]
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
    result->events_data = malloc(sizeof(char) * initial_capacity * (N + 3));
    return result;
}

// Resize result arrays if needed
void resize_simulation_result(struct SimulationResult *result) {
    if (result->num_timesteps >= result->capacity) {
        result->capacity *= 2;
        result->times = realloc(result->times, sizeof(double) * result->capacity);
        result->phases_data = realloc(result->phases_data, sizeof(double) * result->capacity * result->N);
        result->events_data = realloc(result->events_data, sizeof(char) * result->capacity * (result->N + 3));
    }
}

// Add a timestep to results
void add_timestep(struct SimulationResult *result, double time, double *phases, char *event) {
    resize_simulation_result(result);
    
    int idx = result->num_timesteps;
    result->times[idx] = time;
    
    // Copy phases
    for (int i = 0; i < result->N; i++) {
        result->phases_data[idx * result->N + i] = phases[i];
    }
    
    // Copy event string
    int event_len = result->N + 3;
    for (int i = 0; i < event_len; i++) {
        result->events_data[idx * event_len + i] = event[i];
    }
    
    result->num_timesteps++;
}

// Free result structure
void free_simulation_result(struct SimulationResult *result) {
    if (result) {
        free(result->times);
        free(result->phases_data);
        free(result->events_data);
        free(result);
    }
}

// Initialize network with parameters
void init_network_with_params(struct Network *network, int N, double Tmax, double delay, 
                             double strength, double I, double Ijitter, unsigned int seed) {
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
        network->phases[i] = (double) rand() / RAND_MAX;
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
void capture_timestep_callback(double time, double *phases, char *event, void *context) {
    struct SimulationResult *result = (struct SimulationResult *)context;
    add_timestep(result, time, phases, event);
}

// Run simulation and capture results
struct SimulationResult* run_network_simulation(struct Network *network) {
    struct SimulationResult *result = init_simulation_result(network->N, 1000);
    
    // Use the shared core simulation with capture callback
    run_network_core(network, capture_timestep_callback, result);
    
    return result;
} 