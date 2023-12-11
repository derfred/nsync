#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <time.h>
#include <math.h>

#include "nsync.h"

struct NetworkParams default_params = {
  .Tmax = 150,
  .N = 5,
  .delay = 1.59,
  .strength = 0.025,
  .I = 1.04,
  .Ijitter = 0
};

void parse_config(struct NetworkParams *result, int argc, char *argv[]) {
  int opt;
  while ((opt = getopt(argc, argv, "N:T:d:s:I:J:")) != -1) {
    switch (opt) {
      case 'N':
        result->N = atoi(optarg);
        break;
      case 'T':
        result->Tmax = atof(optarg);
        break;
      case 'd':
        result->delay = atof(optarg);
        break;
      case 's':
        result->strength = atof(optarg);
        break;
      case 'I':
        result->I = atof(optarg);
        break;
      case 'J':
        result->Ijitter = atof(optarg);
        break;
      default:
        fprintf(stderr, "Usage: %s [-T Tmax] [-N N] [-d delay] [-s strength] [-I I] [-J Ijitter]\n", argv[0]);
        exit(EXIT_FAILURE);
    }
  }
}

void init_random() {
  pid_t process_id = getpid();  
  time_t current_time = time(NULL);
  unsigned int seed = (unsigned int)(process_id + current_time);
  srand(seed);
}

void initialize(struct Network *network, int argc, char *argv[]) {
  struct NetworkParams params = default_params;
  parse_config(&params, argc, argv);

  init_random();

  network->now      = 0;
  network->N        = params.N;
  network->Tmax     = params.Tmax;
  network->delay    = params.delay;
  network->strength = params.strength;
  network->Ijitter  = params.Ijitter;
  network->currents = (double *) malloc(sizeof(double) * params.N);
  network->periods  = (double *) malloc(sizeof(double) * params.N);
  network->phases   = (double *) malloc(sizeof(double) * params.N);
  network->resets   = (double *) malloc(sizeof(double) * params.N);

  for (int i = 0; i < params.N; i++) {
    network->currents[i] = params.I + i * network->Ijitter;
    network->periods[i]  = log(network->currents[i]/(network->currents[i] - 1));
    network->resets[i]   = -1;
    network->phases[i]   = (double) rand() / RAND_MAX;
  }
}
