if(typeof window == "undefined") {
  module = QUnit.module;

  function log(msg) {
    require("util").log(msg);
  }

  var base = require("../base.js");
  var EventQueue = base.EventQueue;
  var merge = base.merge;
}

function almost_equals(actual, expected, delta) {
  if(!delta) {
    delta = 0.0001;
  }
  QUnit.push(Math.abs(actual-expected) < delta, actual, expected);
}


module("Event Queue", {
  setup: function() {
    evt_queue = new EventQueue();
  }
});

var evt_queue;

test("initialization", function() {
  ok(evt_queue.empty());
});

test("adding an item", function() {
  var event = new Event(1, "mike_check");
  evt_queue.add_event(event);
  ok(!evt_queue.empty());
  equals(evt_queue.pop_next_event(), event);
});

test("popping an item", function() {
  evt_queue.add_event(new Event(1, "mike_check"));
  evt_queue.pop_next_event();
  ok(evt_queue.empty());
});

test("time ordering of items", function() {
  evt_queue.add_event(new Event(1.5, "mike_check"));
  evt_queue.add_event(new Event(1, "feedback_cancel"));
  equals(evt_queue.pop_next_event().time, 1);
});

test("finding an item by predicate", function() {
  var evt1 = new Event(3, "age_check");
  var evt2 = new Event(1.5, "mike_check");
  var evt3 = new Event(2, "age_check");

  evt_queue.add_event(evt1);
  evt_queue.add_event(evt2);
  evt_queue.add_event(evt3);

  equals(evt_queue.pop_next_event(function(e) { return e.type == "age_check"; }), evt3);
});


module("Neuron", {
  setup: function() {
    neuron = new Neuron({ C: 1.04, gamma: 1 });
    neuron.reset(0);    // each test starts with zero phase
  }
});

var neuron;

test("initializing last_reset", function() {
  neuron.initial_phase = 0.5;
  neuron.initialize_last_reset(0);
  equals(neuron.last_reset, -0.5);
});

test("receiving reset sets phase to zero", function() {
  neuron.reset(1.5);
  equals(neuron.current_phase(1.5), 0);
  equals(neuron.current_phase(2), 0.5);
});

test("receiving spike will cause phase jump", function() {
  neuron.receive_spike(0.5, 0.1);
  almost_equals(neuron.current_phase(0.5), 0.6726059759638713);
});

test("receiving reset after spike will reset phase to zero", function() {
  neuron.receive_spike(0.5, 0.1);
  neuron.reset(0.8);
  almost_equals(neuron.current_phase(1), 0.2);
});

test("receiving spike will not set phase beyond 1", function() {
  neuron.receive_spike(0.9, 0.5);
  almost_equals(neuron.current_phase(0.9), 0);
  almost_equals(neuron.current_phase(1), 0.1);
});

test("receiving spike will not set phase below 0", function() {
  neuron.receive_spike(0.1, -0.5);
  almost_equals(neuron.current_phase(0.1), 0);
  almost_equals(neuron.current_phase(0.2), 0.1);
});

test("receiving sub threshold spike will not signal reset", function() {
  ok(!neuron.receive_spike(0.1, 0.1));
});

test("receiving supra threshold spike will signal reset", function() {
  ok(neuron.receive_spike(0.9, 0.5));
});


module("Network");

var network;

test("creating fully_connected network", function() {
  network = Network.fully_connected(10);

  equals(10, network.neurons.length);

  for(var i=0;i<network.neurons.length;i++) {
    equals(9, network.neurons[i].post_synaptic_neurons().length);
  }
});


module("Simulator with default time_factor", {
  setup: function() {
    simulator = new Simulator();
  }
});

var simulator;

asyncTest("time limited run should take about 1s", 2, function() {
  simulator.initialize(Network.fully_connected(10));

  var start_time = (new Date()).getTime();
  simulator.start(1, function() {
    ok(true, "callback happened");
    
    var time_delta = (new Date()).getTime() - start_time;
    ok(time_delta > 900 && time_delta < 1500, "time difference not within expected window: actual="+time_delta);
  });
  
  setTimeout(function() {
    start();
  }, 1500);
});

module("Simulator with zero time_factor", {
  setup: function() {
    simulator = new Simulator(0);
  }
});

asyncTest("simulating free dynamics of single neuron", 1, function() {
  network = new Network();
  var neuron = new Neuron(merge(Network.default_options, {
    initial_phase: 0
  }));
  network.add_neuron(neuron);
  simulator.initialize(network);

  var start_time = (new Date()).getTime();
  simulator.start(1.2, function() {
    var time_delta = (new Date()).getTime() - start_time;
    equals(network.neurons[0].last_reset, 1);
    start();
  });
});
