/*
**  This file illustrates how to set up the simulator.
**  It simulates an empty network
*/

// load in the simulator code
var base = require("../../src/base.js");

// initialize an empty network
var network = new base.Network();

// create the simulator object, the param determines the speed of time passing
// zero means simulate as fast as possible
var simulator = new base.Simulator(0);

// initialize the simulator, this allows you to reuse the simulator object
simulator.initialize(network);

// now start the simulation and let it run for 500 time steps
simulator.start(500, function() {
  // any code here will be called after the simulation has completed
});
