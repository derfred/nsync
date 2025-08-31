#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <unistd.h>

#include "nsync.h"
#include "nsync_core.h"
#include "bitmap.h"

void print_network_vector_with_prefix_and_suffix(struct Network *network, double *vector, char *prefix, char *suffix) {
  printf("%s\t", prefix);
  for (int i = 0; i < network->N; i++) {
    printf("%.10f\t", vector[i]);
  }
  if (suffix != NULL) {
    printf("%s", suffix);
  }
  printf("\n");
}

void print_phases_with_prefix_and_suffix(struct Network *network, char *prefix, char *suffix) {
  print_network_vector_with_prefix_and_suffix(network, network->phases, prefix, suffix);
}

void print_bitmap(const Bitmap *bitmap, char prefix) {
  char buffer[bitmap->n_neurons + 2 + 1];
  build_bitmap(buffer, bitmap, prefix);
  printf("%s\n", buffer);
}

void print_phases(struct Network *network, char * suffix) {
  char prefix[100];
  sprintf(prefix, "%.10f", network->now);
  print_phases_with_prefix_and_suffix(network, prefix, suffix);
}

// Callback function for printing timestep data
void print_timestep_callback(double time, double *phases, 
                            const Bitmap *spike_map, const Bitmap *reset_map, 
                            const Bitmap *total_reset_map,
                            void *context) {
  struct Network *network = (struct Network *)context;
  
  // Build event string from bitmaps
  char event[256] = "";
  if (!bitmap_is_empty(spike_map)) {
    strcat(event, " [SPIKE]");
  }
  if (!bitmap_is_empty(reset_map)) {
    strcat(event, " [RESET]");
  }
  if (!bitmap_is_empty(total_reset_map) && bitmap_is_empty(reset_map)) {
    strcat(event, " [SPIKE-IND-RESET]");
  }
  
  print_phases(network, event);
}

void cpu_run_network(struct Network *network) {
  // Use the shared core simulation with print callback
  run_network_core(network, print_timestep_callback, network);
}

int main(int argc, char *argv[]) {
  struct Network network;
  initialize(&network, argc, argv);

  cpu_run_network(&network);

  return 0;
}
