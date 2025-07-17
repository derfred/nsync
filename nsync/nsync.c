#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <unistd.h>

#include "nsync.h"
#include "nsync_core.h"

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

void print_bitmap(int bitmap, int N, char prefix) {
  char buffer[N + 2 + 1];
  build_bitmap(buffer, bitmap, N, prefix);
  printf("%s\n", buffer);
}

void print_phases(struct Network *network, char * suffix) {
  char prefix[100];
  sprintf(prefix, "%.10f", network->now);
  print_phases_with_prefix_and_suffix(network, prefix, suffix);
}

// Callback function for printing timestep data
void print_timestep_callback(double time, double *phases, char *event, void *context) {
  struct Network *network = (struct Network *)context;
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
