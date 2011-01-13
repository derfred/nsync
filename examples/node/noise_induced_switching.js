/*
**  This example illustrates how to set up a single network containing 5 neurons along with external noise.
**  The effect simulated is based on:
**     F. Schittler Neves and M. Timme, Controlled perturbation-induced switching in pulse-coupled
**     oscillator etworks, J. Phys. A: Math. Theor., pp 345103, ol. 42, 2009.
**     http://www.chaos.gwdg.de/bibliographyfolder.2007-08-05.6165862805/articlereference.2009-09-14.2329130752/at_download/publication_pdf
**
**  This simulation will show how partially synchronized clusters can persist in a fully connected network
**  with homogenous connections. Furthermore adding noise to such a set up will induce persistent switching
**  between states of partial synchrony while preserving the symmetry (S2xS2xS1
**
**  The script will output data in the following format
**     1,1,0.49
**     2,1,0.49
**     3,1,0.10999999999999999
**     4,1,0.10999999999999999
**     1,1.8699999999999999,0.50074407183583
**     2,1.8699999999999999,0.50074407183583
**     3,1.8699999999999999,0.11564957903812645
**     4,1.8699999999999999,0.11564957903812645
**     ....
**
**
**  Every line represents the phase of one neuron at the time the first neuron in the network resets.
**  The first number is the ID of the neuron, followed by the time of the reset of neuron 0,
**  followed by the phase of the neuron referenced by the ID.
**
**  This data can be processed by the Mathematica script tools.nb found in the contrib directory and
**  will generate a graph as in noise_induced_switching.jpg
*/



var base = require("../../src/base.js");

function PoincareObserver() {
  
}

/*
** This observer creates a Poincare Section in state space by recording the
** phases of all other neurons at the reset of neuron 0
*/
PoincareObserver.prototype.event_reset = function(simulator, options) {
  var current_time = simulator.current_time;
  var neuron = options.recipient;

  if(neuron == neuron.network.neurons[0]) {
    neuron.network.each_neuron(function(_neuron) {
      if(_neuron != neuron) {
        var phase = _neuron.current_phase(current_time);
        console.log(_neuron.id+","+current_time+","+phase);
      }
    }.bind(this));  // this bind is not necessary for this example.
                    // however if you want to access the observer object via the this variable in the
                    // callback this is required.
  }
}



/*
**  Generate a fully connected network containing 5 neurons
*/
var network = base.Network.fully_connected(5, {
  delay: 0.49,
  strength: 0.025,
  I: 1.04,
  gamma: 1
});


/*
** These values are are chosen to illustrate partial synchrony.
** Using random initial phases will give qualitatively similar results.
*/
var a = 0; //Math.random();
var b = 0.49; //Math.random();
var c = 0.11; //Math.random();

network.neurons[0].initial_phase = a;
network.neurons[1].initial_phase = b;
network.neurons[2].initial_phase = b;
network.neurons[3].initial_phase = c;
network.neurons[4].initial_phase = c;


// the zero in the parameter means that the simulation is run as fast as possible
// as opposed to some factor * real time
var simulator = new base.Simulator(0);

// add a noise source, which starts operating at time step 60, for the other params see src/base.js
simulator.add_observer(new base.PoissonNoiseGenerator(50, 0.0000000001, {start_time: 60}));

// hook in the observer, defined above, which will record the data
simulator.add_observer(new PoincareObserver());

// initialize the simulator, this allows you to reuse the simulator object
simulator.initialize(network);

// now start the simulation and let it run for 500 time steps
simulator.start(500, function() {
  // any code here will be called after the simulation has completed
});
