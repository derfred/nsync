struct NetworkParams {
  double Tmax;
  int N;
  double delay;
  double strength;
  double I;
  double Ijitter;
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

void initialize(struct Network *network, int argc, char *argv[]);
