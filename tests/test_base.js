var almost_equal;
if(typeof window == "undefined") {
  module = QUnit.module;

  function log(msg) {
    require("util").log(msg);
  }
  
  var base = require("../src/base.js");
  var EventQueue = base.EventQueue;
  var merge = base.merge;

  almost_equals = function(actual, expected, delta) {
    if(!delta) {
      delta = 0.0001;
    }
    ok(Math.abs(actual-expected)<delta);
  }
} else {
  almost_equals = function(actual, expected, delta) {
    if(!delta) {
      delta = 0.0001;
    }
    QUnit.push(Math.abs(actual-expected) < delta, actual, expected);
  }
}


module("Event Queue", {
  setup: function() {
    evt_queue = new EventQueue();
  }
});

var evt_queue;

test("initialization", function() {
  ok(evt_queue.empty());
  equals(evt_queue.find_next_event_index(), undefined);
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
    neuron = new Neuron({ I: 1.04, gamma: 1 });
    neuron.reset(0);    // each test starts with zero phase
  }
});

var neuron;
var standard_period = 3.2580965380214812;

test("initializing", function() {
  neuron.initial_phase = 0.5;
  neuron.initialize(0);
  equals(neuron.current_phase(0), 0.5);
});

test("calculating time scale", function() {
  equals(neuron.T(), standard_period);
  equals((new Neuron({ I: 1.25, gamma: 1 })).T(), 1.6094379124341003);
});

test("receiving reset sets phase to zero", function() {
  neuron.reset(1.5);
  equals(neuron.current_phase(1.5), 0);
  almost_equals(neuron.current_phase(1.5+0.5*neuron.T()), 0.5);
});

test("receiving spike will cause phase jump", function() {
  neuron.receive_spike(0.2*neuron.T(), 0.1);
  equals(neuron.current_phase(0.2*neuron.T()), 0.26259348106668534);
});

test("receiving reset after spike will reset phase to zero", function() {
  neuron.receive_spike(0.5, 0.1);
  neuron.reset(0.8);
  almost_equals(neuron.current_phase(0.8+0.2*neuron.T()), 0.2);
});

test("receiving spike will not set phase beyond 1", function() {
  neuron.receive_spike(0.9*neuron.T(), 0.5);
  almost_equals(neuron.current_phase(0.9*neuron.T()), 0);
  almost_equals(neuron.current_phase(neuron.T()), 0.1);
});

test("receiving spike will not set phase below 0", function() {
  neuron.receive_spike(0.1*neuron.T(), -0.5);
  almost_equals(neuron.current_phase(0.1*neuron.T()), 0);
  almost_equals(neuron.current_phase(0.2*neuron.T()), 0.1);
});

test("receiving sub threshold spike will not signal reset", function() {
  ok(!neuron.receive_spike(0.1, 0.1));
});

test("receiving supra threshold spike will signal reset", function() {
  ok(neuron.receive_spike(0.9, 0.5));
});

test("connecting to other neurons", function() {
  var n2 = new Neuron({ C: 1.04, gamma: 1 });
  neuron.connect(n2, 0.3, 0.4);
  equals(neuron.connections.length, 1);
  equals(neuron.connections[0].post_synaptic, n2);
});

test("labelling connections", function() {
  var n2 = new Neuron({ C: 1.04, gamma: 1 });
  neuron.connect(n2, 0.3, 0.4, "inter");
  equals(neuron.connections[0].label, "inter");
});


module("Network", {
  setup: function() {
    network = new Network();
  }
});

var network;

test("adding new neuron", function() {
  var n1 = network.new_neuron(Network.default_options);
  equals(n1.constructor, Neuron);
  equals(n1.id, "0");
  equals(network.neurons.length, 1);
});

test("iterating all neurons", function() {
  expect(10);
  network = Network.fully_connected(10);
  network.each_neuron(function(neuron) {
    ok(true);
  });
});

test("testing whether a network contains a neuron", function() {
  var net1 = network.new_sub_network();
  var n1 = net1.new_neuron(Network.default_options);
  var net2 = network.new_sub_network();

  ok(net1.contains(n1));
  ok(network.contains(n1));
  ok(!net2.contains(n1));
});

test("adding a neuron to a network with prefix", function() {
  network = new Network("a");
  var n1 = network.new_neuron(Network.default_options);
  equals(n1.id, "a0");
});

test("creating fully_connected network", function() {
  network = Network.fully_connected(10);

  equals(10, network.neurons.length);

  for(var i=0;i<network.neurons.length;i++) {
    equals(9, network.neurons[i].connections.length);
  }
});

test("adding an empty sub network", function() {
  var sub_network = network.new_sub_network();
  equals(sub_network.constructor, Network);
  equals(network.sub_networks.length, 1);
});

test("adding a sub network without prefix will generate one", function() {
  var sub_network = network.new_sub_network();
  equals(sub_network.prefix, "a");
});

test("adding a sub network without prefix will update included neuron ids", function() {
  var sub_net = network.add_sub_network(Network.fully_connected(10));
  sub_net.each_neuron(function(neuron) {
    equals(neuron.id[0], "a");
  });
});

test("counting the total number of neurons across sub networks", function() {
  network.add_sub_network(Network.fully_connected(10));
  network.add_sub_network(Network.fully_connected(10));
  equals(network.number_of_neurons(), 20);
});

test("iterating a network containing sub networks", function() {
  network.add_sub_network(Network.fully_connected(10));
  network.add_sub_network(Network.fully_connected(10));

  expect(20);
  network.each_neuron(function(neuron) {
    ok(true);
  });
});

test("iterating a network containing sub networks should ignore neurons on the main network", function() {
  network.add_sub_network(Network.fully_connected(10));
  network.new_neuron(Network.default_options);
  network.new_neuron(Network.default_options);

  expect(10);
  network.each_neuron(function(neuron) {
    ok(true);
  });
});

test("collecting all neurons", function() {
  var net1 = network.new_sub_network("a");
  var n1 = net1.new_neuron({ C: 1.04, gamma: 1 });
  var net2 = network.new_sub_network("b");
  var n2 = net2.new_neuron({ C: 1.04, gamma: 1 });

  var result = network.all_neurons();
  equals(result[0].id, n1.id);
  equals(result[1].id, n2.id);
});

test("collecting all networks", function() {
  var net1 = network.new_sub_network();
  var net2 = network.new_sub_network();

  var result = network.all_networks();
  equals(result[0], net1);
  equals(result[1], net2);
});


module("Network synchronization status", {
  setup: function() {
    network = new Network();
    for(var i=0;i<5;i++) {
      network.new_neuron(Network.default_options);
    }
  }
});

test("detecting asynchrony", function() {
  network.each_neuron(function(neuron, i) {
    neuron.set_phase(0, i*0.1);
  });

  var result = network.synced_neurons(0, 0.001);
  equals(result.length, 5);
  equals(result[0][0].id, network.neurons[0].id);
  equals(result[1][0].id, network.neurons[1].id);
  equals(result[2][0].id, network.neurons[2].id);
  equals(result[3][0].id, network.neurons[3].id);
  equals(result[4][0].id, network.neurons[4].id);
});

test("detecting full synchrony within tolerance", function() {
  network.each_neuron(function(neuron) {
    var delta = (Math.random()-0.5) * 1e-6;
    neuron.set_phase(0, 0.5+delta);
  });

  var result = network.synced_neurons(0, 0.001);
  equals(result.length, 1);
  for(var i=0;i<5;i++) {
    equals(network.neurons[i].id, result[0][i].id);
  }
});

test("detecting partial synchrony", function() {
  network.neurons[0].set_phase(0, 0.301);
  network.neurons[1].set_phase(0, 0.401);
  network.neurons[2].set_phase(0, 0.302);
  network.neurons[3].set_phase(0, 0.403);
  network.neurons[4].set_phase(0, 0.701);

  var result = network.synced_neurons(0, 0.01);
  equals(result.length, 3);
  equals(result[0][0].id, network.neurons[0].id);
  equals(result[0][1].id, network.neurons[2].id);
  equals(result[1][0].id, network.neurons[1].id);
  equals(result[1][1].id, network.neurons[3].id);
  equals(result[2][0].id, network.neurons[4].id);
});


module("Simulator with zero time_factor", {
  setup: function() {
    simulator = new Simulator(0);
    simulator.save_events = true;
  }
});

test("spike collation", function() {
  network = new Network();
  var n1 = network.new_neuron(Network.default_options);
  var n2 = network.new_neuron(Network.default_options);

  simulator.new_event(0.5, "spike", {recipient: n1, strength: 0.3});
  simulator.new_event(0.5, "spike", {recipient: n1, strength: 0.3});
  simulator.new_event(0.5, "spike", {recipient: n2, strength: 0.3});

  equals(simulator.event_queue.events.length, 2);
  equals(simulator.event_queue.events[0].options.strength, 0.6);
  equals(simulator.event_queue.events[0].options.recipient.id, n1.id);
});

asyncTest("adding observers", 2, function() {
  function TestObserver() {}
  TestObserver.prototype.event_initialize = function(_simulator) {
    equals(_simulator.current_time, 0);
  }
  TestObserver.prototype.event_reset = function(_simulator) {
    equals(_simulator.current_time, 0.5*neuron.T());
  }

  network = new Network();
  var neuron = network.new_neuron({ initial_phase: 0.5, I: 1.04, gamma: 1 });

  simulator.add_observer(new TestObserver());
  simulator.initialize(network);
  simulator.start(2, function() {
    start();
  });
});

asyncTest("spike labelling", 3, function() {
  function SpikeLabelObserver() {}
  SpikeLabelObserver.prototype.event_spike = function(_simulator, _options) {
    almost_equals(_simulator.current_time, 0.3+0.1*_options.recipient.T());
    equals(_options.label, "gnu");
    equals(_options.strength, 0.5);
  }

  network = new Network();
  neuron = network.new_neuron({ initial_phase: 0.9, I: 1.04, gamma: 1 });
  neuron.connect(neuron, 0.3, 0.5, "gnu");

  simulator.add_observer(new SpikeLabelObserver());
  simulator.initialize(network);
  simulator.start(1, function() {
    start();
  });
});

asyncTest("simulating free dynamics of single neuron", 2, function() {
  network = new Network();
  var neuron = network.new_neuron(merge(Network.default_options, {
    initial_phase: 0
  }));
  simulator.initialize(network);

  simulator.start(1.2*neuron.T(), function() {
    almost_equals(network.neurons[0].current_phase(1.2*neuron.T()), 0.2);
    equals(simulator.past_events.length, 2);

    start();
  });
});

asyncTest("simulating dynamics of single transmitted spike", function() {
  network = new Network();
  var n1 = network.new_neuron({ I: 1.04, gamma: 1, initial_phase: 0.9 });
  var n2 = network.new_neuron({ I: 1.04, gamma: 1, initial_phase: 0 });

  n1.connect(n2, 0.3, 0.1);

  simulator.initialize(network);
  simulator.start(0.5*n1.T(), function() {
    equals(n1.current_phase(0.5*n1.T()), 0.4);
    almost_equals(n2.current_phase(0.5*n1.T()), 0.5608294484932627);
    almost_equals(n2.last_spike.time, 0.1*n1.T()+0.3);
    equals(simulator.past_events.length, 3);

    start();
  });
});

asyncTest("simulating dynamics of single phase shift spike", 2, function() {
  network = new Network();
  neuron = network.new_neuron({ I: 1.04, gamma: 1, initial_phase: 0 });

  simulator.initialize(network);
  simulator.new_event(0.3, "phase_shift", {recipient: neuron, phase_shift: 0.2})
  simulator.start(0.5*neuron.T(), function() {
    equals(neuron.current_phase(0.5*neuron.T()), 0.7);
    equals(simulator.past_events.length, 2);

    start();
  });
});

asyncTest("simulating dynamics of two consequtive spikes sent to one neuron", function() {
  network = new Network();
  var n1 = network.new_neuron({ I: 1.04, gamma: 1, initial_phase: 0.9 });
  var n2 = network.new_neuron({ I: 1.04, gamma: 1, initial_phase: 0 });

  n1.connect(n2, 0.3, 0.2);

  simulator.initialize(network);
  simulator.start(1.5*n1.T(), function() {
    almost_equals(network.neurons[0].current_phase(1.5*n1.T()), 0.4);
    almost_equals(network.neurons[1].current_phase(1.5*n1.T()), 0.1);
    almost_equals(network.neurons[1].last_spike.time, 1.4*n1.T());
    equals(simulator.past_events.length, 6);

    start();
  });
});

asyncTest("simulating dynamics of two neurons in different sub networks", function() {
  network = new Network();
  var net1 = network.new_sub_network("a");
  var n1 = net1.new_neuron({ I: 1.04, gamma: 1, initial_phase: 0.9 });
  var net2 = network.new_sub_network("b");
  var n2 = net2.new_neuron({ I: 1.04, gamma: 1, initial_phase: 0 });

  n1.connect(n2, 0.3, 0.2);

  simulator.initialize(network);
  simulator.start(1.5, function() {
    almost_equals(net1.neurons[0].current_phase(1.5), 0.4);
    almost_equals(net2.neurons[0].current_phase(1.5), 0.1);
    almost_equals(net2.neurons[0].last_spike.time, 1.4);
    equals(simulator.past_events.length, 6);

    start();
  });
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
