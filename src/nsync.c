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
};

struct NetworkParams params = {
  .Tmax = 50,
  .delay = 0.59,
  .strength = 0.005,
  .I = 1.04
};

void initialize(double *phases, double *resets, int n) {
  for (int i = 0; i < n; i++) {
    resets[i] = -1;
    phases[i] = (double) rand() / RAND_MAX;
  }
}

double gf(double phi, double eps) {
  double Tif = log(params.I/(params.I - 1));
  double V   = params.I * (1 - exp(-1 * Tif * phi)) + eps;

  if (V > 1) {
    return 1;
  } else {
    return -log(1 - V/params.I) / Tif;
  }
}

int main(int argc, char *argv[]) {
  if (argc > 3) {
    params.Tmax     = atof(argv[1]);
    params.delay    = atof(argv[2]);
    params.strength = atof(argv[3]);
  }

  const int N = 5;
  double phases[5];

  double resets[5];
  double now = 0;

  pid_t process_id = getpid();  
  time_t current_time = time(NULL);
  unsigned int seed = (unsigned int)(process_id + current_time);
  srand(seed);

  initialize(phases, resets, N);
  // printf("-> %f\t%f\t%f\t%f\t%f\n", phases[0], phases[1], phases[2], phases[3], phases[4]);

  while (now < params.Tmax) {
    double next_reset = params.Tmax;
    int reset_map     = 0;

    double next_spike = params.Tmax;
    int spike_map     = 0;

    for (int i = 0; i < N; i++) {
      if (now + 1 - phases[i] < next_reset) {
        next_reset = now + 1 - phases[i];
        reset_map = 1 << i;
      } else if (now + 1 - phases[i] == next_reset) {
        reset_map |= 1 << i;
      }

      if (resets[i] > 0) {
        double _next_spike = resets[i] + params.delay;
        if (_next_spike > now) {
          if (_next_spike < next_spike) {
            next_spike = _next_spike;
            spike_map = 1 << i;
          } else if (_next_spike == next_spike) {
            spike_map |= 1 << i;
          }
        }
      }
    }
    double _now = fmin(next_reset, next_spike);
    // printf("%f\t%f\t%f\n", _now, next_reset, next_spike);
    for (int i = 0; i < N; i++) {
      phases[i] += _now - now;
    }

    if (next_reset < next_spike) {
      // printf("r %f\t%f\t%f\t%f\t%f\t%f\n", _now, phases[0], phases[1], phases[2], phases[3], phases[4]);
      for (int i = 0; i < N; i++) {
        if (reset_map & (1 << i)) {
          resets[i] = _now;
          phases[i] = 0;
        }
      }
    } else {
      // printf("%f\t%f\t%f\t%f\t%f\t%f\n", _now-0.00001, phases[0], phases[1], phases[2], phases[3], phases[4]);
      // printf("s %f\t%f\t%f\t%f\t%f\t%f\n", _now, phases[0], phases[1], phases[2], phases[3], phases[4]);
      for (int i = 0; i < N; i++) {
        double eps = 0;
        for (int j = 0; j < N; j++) {
          if (i != j) {
            if (spike_map & (1 << j)) {
              eps += params.strength;
            }
          }
        }
        if (eps > 0) {
          phases[i] = gf(phases[i], eps);
        }
        if (phases[i] >= 1) {
          resets[i] = _now;
          phases[i] = 0;
        }
      }
    }
    now = _now;

    printf("%f\t%f\t%f\t%f\t%f\t%f\n", now, phases[0], phases[1], phases[2], phases[3], phases[4]);
  }

  return 0;
}
