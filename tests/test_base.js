if(typeof window == "undefined") {
  module = QUnit.module;

  function log(msg) {
    require("util").log(msg);
  }

  var base = require("../base.js");
  var EventQueue = base.EventQueue;
  var merge = base.merge;
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


module("Neuron");

var neuron;

test("initialize last_reset", function() {
  neuron = new Neuron({ C: 1.04, gamma: 1 });
  neuron.initial_phase = 0.5;
  neuron.initialize_last_reset(0);
  equals(neuron.last_reset, -0.5);
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
