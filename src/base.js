function export(name, type) {
  if(typeof(exports) != "undefined") {
    exports[name] = type;
  }
}

function log(msg) {
  if(typeof(require) != "undefined") {
    require("util").log(msg);
  } else {
    
  }
}

function merge(left, right) {
  if(!right) {
    return left;
  } else {
    for(k in left) {
      if(!right[k]) {
        right[k] = left[k];
      }
    }
    return right;
  }
}

function defer(callback, waittime) {
  if(typeof(require) == "undefined" || waittime > 0) {
    setTimeout(callback, waittime);
  } else {
    process.nextTick(callback);
  }
}

export("merge", merge);

if(typeof(Function.prototype.bind) != "function") {
  Function.prototype.bind = function(self, var_args) {
    var thisFunc = this;
    var leftArgs = Array.slice(arguments, 1);
    return function(var_args) {
      var args = leftArgs.concat(Array.slice(arguments, 0));
      return thisFunc.apply(self, args);
    };
  };
}


function Network(prefix) {
  this.neurons = [];
  this.sub_networks = [];
  this.prefix = prefix != undefined ? prefix : "";
}

Network.default_options = {
  delay: 0.3,
  strength: 0.023,
  I: 1.04,
  gamma: 1
};

Network.fully_connected = function(total, options) {
  options = merge(Network.default_options, options);

  var network = new Network();
  for (var i=0; i < total; i++) {
    var initial_phase = undefined;
    if(options.initial_phases) {
      initial_phase = options.initial_phases[i];
    }

    network.new_neuron({
      I: options.I,
      gamma: options.gamma,
      initial_phase: initial_phase
    });
  };

  for (var i=0; i < network.neurons.length; i++) {
    for (var j=0; j < network.neurons.length; j++) {
      if (j != i) {
        network.neurons[i].connect(network.neurons[j], options.delay, options.strength);
      }
    };
  };

  return network;
}

Network.prototype.synced_neurons = function(current_time, delta) {
  var result = [];
  var copy = this.neurons.slice();
  while(copy.length > 0) {
    var current = copy.shift();
    var current_phase = current.current_phase(current_time);
    var current_sync = [current];
    for(var i=0;i<copy.length;i++) {
      if(Math.abs(current_phase-copy[i].current_phase(current_time))<delta) {
        current_sync.push(copy[i]);
      }
    }

    for(var i=copy.length-1;i>=0;i--) {
      for(var j=0;j<current_sync.length;j++) {
        if(copy[i] == current_sync[j]) {
          copy.splice(i, 1);
        }
      }
    }

    result.push(current_sync);
  }
  return result;
}

Network.prototype.set_prefix = function(prefix) {
  this.prefix = prefix;
  if(this.has_sub_networks()) {
    for(var i=0;i<this.sub_networks.length;i++) {
      this.sub_networks[i].set_prefix(this.prefix+this.sub_networks[i]);
    }
  } else {
    for(var i=0;i<this.neurons.length;i++) {
      this.neurons[i].id = this.prefix + this.neurons[i].id;
    }
  }
}

Network.prototype.has_sub_networks = function() {
  return this.sub_networks.length > 0;
}

Network.prototype.new_sub_network = function(prefix) {
  var sub_network = new Network(prefix);
  return this.add_sub_network(sub_network);
}

Network.prototype.add_sub_network = function(sub_network) {
  sub_network.set_prefix(this.prefix+String.fromCharCode(97+this.sub_networks.length));
  this.sub_networks.push(sub_network);
  return sub_network;
}

Network.prototype.all_networks = function() {
  if(this.has_sub_networks()) {
    return this.sub_networks;
  } else {
    return [this];
  }
}

Network.prototype.new_neuron = function(options) {
  var neuron = new Neuron(options);
  return this.add_neuron(neuron);
}

Network.prototype.add_neuron = function(neuron) {
  neuron.id = this.prefix + this.neurons.length;
  neuron.network = this;
  this.neurons.push(neuron);
  return neuron;
};

Network.prototype.number_of_neurons = function() {
  if(this.has_sub_networks()) {
    var result = 0;
    for(var i=0;i<this.sub_networks.length;i++) {
      result += this.sub_networks[i].number_of_neurons();
    }
    return result;
  } else {
    return this.neurons.length;
  }
}

Network.prototype.all_neurons = function() {
  var result = [];
  this.each_neuron(function(n) {
    result.push(n);
  });
  return result;
}

Network.prototype.each_neuron = function(callback, base) {
  base = base == undefined ? 0 : base
  if(this.has_sub_networks()) {
    var count = 0;
    for(var i=0;i<this.sub_networks.length;i++) {
      count += this.sub_networks[i].each_neuron(callback, base+count);
    }
    return count;
  } else {
    for(var i=0;i<this.neurons.length;i++) {
      callback(this.neurons[i], base+i);
    }
    return this.neurons.length;
  }
}

Network.prototype.contains = function(neuron) {
  var result = false;
  this.each_neuron(function(_neuron) {
    // TODO break after finding the neuron
    result = result || (_neuron == neuron);
  });
  return result;
}

Network.prototype.get_neuron_by = function(neuron_id) {
  return this.neurons.filter(function(neuron) {
    return neuron.id == neuron_id;
  })[0];
}

export("Network", Network);



function Neuron(options) {
  this.initial_phase = options.initial_phase != undefined ? options.initial_phase : Math.random();
  this.gamma = options.gamma;
  this.I = options.I;
  this.connections = [];
};

Neuron.prototype.initialize = function(current_time) {
  this.set_phase(current_time, this.initial_phase);
}

Neuron.prototype.reset = function(current_time) {
  this.set_phase(current_time, 0);
}

Neuron.prototype.next_reset = function(current_time) {
  return current_time + 1 - this.current_phase(current_time);
}

Neuron.prototype.current_phase = function(current_time) {
  return current_time - this.last_spike.time + this.last_spike.phase;
}

Neuron.prototype.set_phase = function(current_time, phase) {
  this.last_spike = {time: current_time, phase: Math.max(0, phase)};
}

Neuron.prototype.connect = function(post_synaptic, delay, strength, label) {
  this.connections.push({
    pre_synaptic: this,
    post_synaptic: post_synaptic,
    delay: delay,
    strength: strength,
    label: label
  });
}

Neuron.prototype.receive_spike = function(current_time, strength) {
  var new_phase = this.phase_jump(this.current_phase(current_time), strength);
  if(isNaN(new_phase) || new_phase > 1) {
    this.set_phase(current_time, 0);
    return true;
  } else {
    this.set_phase(current_time, Math.max(0, new_phase));
    return false;
  }
}

Neuron.prototype.phase_jump = function(current_phase, strength) {
  return this.g(strength + this.f(current_phase));
}

Neuron.prototype.T = function() {
  return Math.log(this.I/(this.I-this.gamma))/this.gamma;
}

Neuron.prototype.f = function(phase) {
  return this.I/this.gamma * (1 - Math.exp(-phase*this.T()))
},

Neuron.prototype.g = function(x) {
  return -(1/this.T()) * Math.log(1 - x*this.gamma/this.I);
}

export("Neuron", Neuron);



function Event(time, type, options) {
  this.time = time;
  this.type = type;

  if(options) {
    this.options = options;
  } else {
    this.options = {};
  }
}

Event.prototype.toString = function() {
  var result = "type: " + this.type + "\ttime: " + this.time;
  if(this.options.recipient) {
    result += ("\trecipient: " + this.options.recipient.id);
  }
  return result;
}

export("Event", Event);


function EventQueue() {
  this.events = [];
}

EventQueue.prototype.clear = function() {
  this.events = [];
}

EventQueue.prototype.empty = function() {
  return this.events.length == 0;
}

EventQueue.prototype.sort_queue = function() {
  this.events.sort(function(a, b) {
    if(a.time == b.time && a.options.recipient && b.options.recipient) {
      var a_id = parseInt(a.options.recipient.id.replace(/\D/, ""));
      var b_id = parseInt(b.options.recipient.id.replace(/\D/, ""));
      return a_id-b_id;
    } else {
      return a.time-b.time;
    }
  });
}

EventQueue.prototype.add_event = function(event) {
  this.events.push(event);
  this.sort_queue();
}

EventQueue.prototype.find_next_event_index = function(predicate) {
  this.sort_queue();

  if(this.events.length == 0) {
    return;
  }

  if(!predicate) {
    return 0;
  }

  for (var i=0; i < this.events.length; i++) {
    if(predicate(this.events[i])) {
      return i;
    }
  };
}

EventQueue.prototype.find_next_event = function(predicate) {
  var index = this.find_next_event_index(predicate);
  if(index != undefined) {
    return this.events[index];
  }
}

EventQueue.prototype.remove_indexed_event = function(index) {
  this.events.splice(index, 1);
}

EventQueue.prototype.pop_next_event = function(predicate) {
  index = this.find_next_event_index(predicate);
  event = this.events[index];
  this.remove_indexed_event(index);
  return event;
}

EventQueue.prototype.dump_queue = function() {
  result = [];
  for(var i=0;i<this.events.length;i++) {
    result.push(this.events[i].toString());
  }
  return result;
}

export("EventQueue", EventQueue);


/*
*  This noise generator will simulate noise via a poisson process of spikes added to each neuron.
*  The spikes will be positive or negative with equal probability.
*  By specifying the network parameter, the noise can be localized to a specific subnetwork
*
*  This is used in the following way:
*    var simulator = new Simulator();
*    var network = new Network(.....);
*
*    // this adds noise to the entire network
*    simulator.add_observer(new PoissonNoiseGenerator(0.5, 0.02));
*
*    // this adds noise only to a sub network
*    simulator.add_observer(new PoissonNoiseGenerator(0.5, 0.02, {"network": network}));
*
*    // also can add a start time for the noise, then the generator will be turned on at that time:
*    simulator.add_observer(new PoissonNoiseGenerator(0.5, 0.02, {"start_time": 20}));
*
*/
function PoissonNoiseGenerator(rate, amplitude, options) {
  this.rate = rate;
  this.amplitude = amplitude;
  this.network = options ? options.network : undefined;
  this.start_time = (options && options.start_time) ? options.start_time : 0;
}

PoissonNoiseGenerator.prototype.event_initialize = function(simulator) {
  var network = this.network ? this.network : simulator.network;
  network.each_neuron(this.add_noise_event.bind(this, simulator));
}

PoissonNoiseGenerator.prototype.event_noise = function(simulator, options) {
  // If multiple noise generators for different sub networks are present,
  // each generator needs to ensure to only operate on its sub network.
  var network = this.network ? this.network : simulator.network;
  if(network.contains(options.recipient)) {
    simulator.propagate_event("spike", options);
    this.add_noise_event(simulator, options.recipient);
  }
}

PoissonNoiseGenerator.prototype.add_noise_event = function(simulator, neuron) {
  var strength = (Math.random() - 0.5) * this.amplitude;
  var time = Math.max(this.start_time, this.next_time(simulator.current_time))
  simulator.new_event(time, "noise", {
    recipient: neuron,
    strength: strength
  });
}

PoissonNoiseGenerator.prototype.next_time = function(current_time) {
  // this generates a random number with exponential distribution
  return current_time - (1/this.rate)*Math.log(Math.random());
}

export("PoissonNoiseGenerator", PoissonNoiseGenerator);


function NetworkDynamicsObserver() {
  
}

NetworkDynamicsObserver.prototype.add_event = function(event, event_queue) {
  if(event.type == "spike") {
    // spike for the same neuron seperated by by less than this amount are collated
    var min_spike_seperation = 10e-6;
    var existing_event = event_queue.find_next_event(function(evt) {
      return evt.options.recipient == event.options.recipient && 
                Math.abs(evt.time - event.time) < min_spike_seperation;
    });
    if(existing_event) {
      existing_event.options.strength += event.options.strength;
    } else {
      event_queue.add_event(event);
    }
  } else {
    event_queue.add_event(event);
  }
}

NetworkDynamicsObserver.prototype.event_initialize = function(simulator) {
  simulator.network.each_neuron(function(neuron) {
    neuron.initialize(simulator.current_time);
    simulator.new_event(neuron.next_reset(simulator.current_time), "reset", {recipient: neuron});
  });
}

NetworkDynamicsObserver.prototype.event_reset = function(simulator, options) {
  var neuron = options.recipient;
  neuron.reset(simulator.current_time);

  var next_reset = neuron.next_reset(simulator.current_time);
  simulator.new_event(next_reset, "reset", {recipient: neuron});

  for (var i=0; i < neuron.connections.length; i++) {
    simulator.new_event(simulator.current_time+neuron.connections[i].delay, "spike", {
      sender: neuron,
      recipient: neuron.connections[i].post_synaptic,
      strength: neuron.connections[i].strength,
      label: neuron.connections[i].label
    });
  }
}

NetworkDynamicsObserver.prototype.event_spike = function(simulator, options) {
  var reset_event_index = simulator.event_queue.find_next_event_index(function(evt) {
    return evt.type == "reset" && evt.options.recipient == event.options.recipient;
  });
  if(reset_event_index != undefined) {
    simulator.event_queue.remove_indexed_event(reset_event_index);
  }

  // because of rounding errors the effect of a spike causing a reset needs to be handled explicitly
  var fired = options.recipient.receive_spike(simulator.current_time, options.strength);
  if(fired) {
    simulator.propagate_event("reset", { recipient: options.recipient });
  } else {
    var next_reset = options.recipient.next_reset(simulator.current_time);
    simulator.new_event(next_reset, "reset", {recipient: options.recipient});
  }
}

NetworkDynamicsObserver.prototype.event_stop = function(simulator, options) {
  simulator.event_queue.clear();
  if(options.callback) {
    defer(options.callback, 10);
  }
}



function Simulator(time_factor) {
  this.event_queue = new EventQueue();
  this.dynamics = new NetworkDynamicsObserver();
  this.observers = [];

  this.time_factor = time_factor != undefined ? time_factor : 1000;
}

Simulator.prototype.add_observer = function(observer) {
  this.observers.push(observer);
}

Simulator.prototype.propagate_event = function(type, options) {
  for(var i=0;i<this.observers.length;i++) {
    if(typeof(this.observers[i]["event_"+type]) == "function") {
      this.observers[i]["event_"+type](this, options);
    }
  }

  // make sure dynamics happen after the observers, otherwise the
  // events propagated to the observers might be in the wrong order
  // ie. if a spike causes reset, the spike event needs to be propagated
  // before the reset event
  if(typeof(this.dynamics["event_"+type]) == "function") {
    this.dynamics["event_"+type](this, options);
  }
}

Simulator.prototype.initialize = function(network) {
  this.network = network;

  this.current_time = 0.0;
  this.event_queue.clear();
  this.past_events = [];

  this.propagate_event("initialize");
}

Simulator.prototype.reset = function() {
  this.observers = [];
}

Simulator.prototype.execute_event = function(evt) {
  // this slows the simulation so that it is observable
  this.execute_timed(evt, function(event) {
    if(this.save_events) {
      this.past_events.push(event);
    }

    this.propagate_event(event.type, event.options);

    var event = this.event_queue.pop_next_event();
    if(event) {
      this.execute_event(event);
    }
  });
}

Simulator.prototype.execute_timed = function(event, callback) {
  var self = this;
  this.next_event_time = event.time;
  defer(function() {
    self.current_time = event.time;
    callback.apply(self, [event]);
  }, this.wait_time(event));
}

Simulator.prototype.new_event = function(time, type, options) {
  // the network dynamics get to change events being added to the queue
  this.dynamics.add_event(new Event(time, type, options), this.event_queue);
}

Simulator.prototype.wait_time = function(event) {
  if(event.time >= this.current_time) {
    var wait = event.time*this.time_factor + this.real_start_time - (new Date()).getTime();
    return Math.max(wait, 0);
  } else {
    return 0;
  }
}

Simulator.prototype.start = function(stop_time, callback) {
  if(stop_time) {
    this.event_queue.add_event(new Event(stop_time, "stop", {callback: callback}));
  }

  this.real_start_time = (new Date()).getTime();
  var event = this.event_queue.pop_next_event();
  this.execute_event(event);
}

Simulator.prototype.stop = function(callback) {
  this.event_queue.add_event(new Event(this.next_event_time, "stop", {callback: callback}))
}

Simulator.prototype.perturb_neuron = function(neuron_id, strength) {
  var neuron = this.network.get_neuron_by(neuron_id);
  this.event_queue.add_event(new Event(this.next_event_time, "spike", {recipient: neuron, strength: strength}))
}

export("Simulator", Simulator);
