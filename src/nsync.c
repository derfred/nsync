#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <math.h>
#include <unistd.h>

struct NetworkParams {
  double Tmax;
  double delay;
  double strength;
  double I;
  double Ijitter;
};

struct NetworkParams params = {
  .Tmax = 150,
  .delay = 1.89,
  .strength = 0.005,
  .I = 1.04,
  .Ijitter = 0
};

struct Network {
  int N;
  double now;
  double Tmax;
  double delay;
  double strength;
  double Ijitter;
  double *currents;
  double *periods;
  double *phases;
  double *resets;
};

void init_random() {
  pid_t process_id = getpid();  
  time_t current_time = time(NULL);
  unsigned int seed = (unsigned int)(process_id + current_time);
  srand(seed);
}

void initialize(struct Network *network, int N, int argc, char *argv[]) {
  init_random();

  network->N        = N;
  network->now      = 0;
  network->Tmax     = params.Tmax;
  network->delay    = params.delay;
  network->strength = params.strength;
  network->Ijitter  = params.Ijitter;
  network->currents = (double *) malloc(sizeof(double) * N);
  network->periods  = (double *) malloc(sizeof(double) * N);
  network->phases   = (double *) malloc(sizeof(double) * N);
  network->resets   = (double *) malloc(sizeof(double) * N);

  if (argc > 3) {
    network->Tmax     = atof(argv[1]);
    network->delay    = atof(argv[2]);
    network->strength = atof(argv[3]);

    if (argc > 4) {
      network->Ijitter = atof(argv[4]);
    }
  }

  for (int i = 0; i < N; i++) {
    network->currents[i] = params.I + network->Ijitter * ((double) rand() / RAND_MAX);
    network->periods[i]  = log(network->currents[i]/(network->currents[i] - 1));
    network->resets[i]   = -1;
    network->phases[i]   = (double) rand() / RAND_MAX;
  }
}

double time_to_reset(struct Network *network, int i) {
  return (1 - network->phases[i]) * network->periods[i];
}

double gf(struct Network *network, int i, double eps) {
  double V = network->currents[i] * (1 - exp(-1 * network->periods[i] * network->phases[i])) + eps;

  if (V > 1) {
    return 1;
  } else {
    return -log(1 - V/network->currents[i]) / network->periods[i];
  }
}

void print_network_vector_with_prefix(struct Network *network, double *vector, char *prefix) {
  printf("%s\t", prefix);
  for (int i = 0; i < network->N; i++) {
    printf("%.5f\t", vector[i]);
  }
  printf("\n");
}

void print_phases_with_prefix(struct Network *network, char *prefix) {
  print_network_vector_with_prefix(network, network->phases, prefix);
}

void print_bitmap(int bitmap, int N, char *prefix) {
  printf("%s\t", prefix);
  for (int i = 0; i < N; i++) {
    printf("%d", (bitmap & (1 << i)) > 0);
  }
  printf("\n");
}

void print_phases(struct Network *network) {
  char prefix[100];
  sprintf(prefix, "%.5f", network->now);
  print_phases_with_prefix(network, prefix);
}

int main(int argc, char *argv[]) {
  struct Network network;
  initialize(&network, 5, argc, argv);

  while (network.now < network.Tmax) {
    double next_reset = network.Tmax;
    int reset_map     = 0;

    double next_spike = network.Tmax;
    int spike_map     = 0;

    // 1. find time to next event, and determine type of event
    for (int i = 0; i < network.N; i++) {
      double _next_reset = network.now + time_to_reset(&network, i);
      if (_next_reset < next_reset) {
        next_reset = _next_reset;
        reset_map = 1 << i;
      } else if (_next_reset == next_reset) {
        reset_map |= 1 << i;
      }

      if (network.resets[i] > 0) {
        double _next_spike = network.resets[i] + network.delay;
        if (_next_spike > network.now) {
          if (_next_spike < next_spike) {
            next_spike = _next_spike;
            spike_map = 1 << i;
          } else if (_next_spike == next_spike) {
            spike_map |= 1 << i;
          }
        }
      }
    }

    // 2. advance phases
    double _now = fmin(next_reset, next_spike);
    double dt   = _now - network.now;
    for (int i = 0; i < network.N; i++) {
      network.phases[i] += dt / network.periods[i];
    }

    if (next_reset < next_spike) {
      // 3.a. if reset -> issue spikes
      for (int i = 0; i < network.N; i++) {
        if (reset_map & (1 << i)) {
          network.resets[i] = _now;
          network.phases[i] = 0;
        }
      }
    } else {
      // 3.b. if spike -> jump phases, reset if necessary
      for (int i = 0; i < network.N; i++) {
        double eps = 0;
        for (int j = 0; j < network.N; j++) {
          if (i != j) {
            if (spike_map & (1 << j)) {
              eps += network.strength;
            }
          }
        }
        if (eps > 0) {
          network.phases[i] = gf(&network, i, eps);
        }
        if (network.phases[i] >= 1) {
          network.resets[i] = _now;
          network.phases[i] = 0;
        }
      }
    }
    network.now = _now;
    print_phases(&network);
  }

  return 0;
}
