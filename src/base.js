function export_sym(name, type) {
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

export_sym("merge", merge);


function get_time() {
  return (new Date()).getTime();
}

export_sym("get_time", get_time);


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

function add_jitter(base, jitter) {
  var result = base;
  if(jitter) {
    result += (2*jitter*(Math.random()-0.5));
  }
  return result;
}


function Network(prefix) {
  this.neurons = [];
  this.sub_networks = [];
  this.prefix = prefix != undefined ? prefix : "";
}

Network.default_options = {
  delay: 1.59,
  strength: 0.025,
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
      I: add_jitter(options.I, options.I_jitter),
      gamma: add_jitter(options.gamma, options.gamma_jitter),
      initial_phase: initial_phase,
      partial_reset_factor: options.partial_reset_factor
    });
  };

  for (var i=0; i < network.neurons.length; i++) {
    for (var j=0; j < network.neurons.length; j++) {
      if (j != i) {
        network.neurons[i].connect(
          network.neurons[j],
          add_jitter(options.delay, options.delay_jitter),
          add_jitter(options.strength, options.strength_jitter)
        );
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

Network.prototype.serialize = function() {
  var result = [];
  if(this.has_sub_networks()) {
    for(var i=0;i<this.sub_networks.length;i++) {
      result.push(this.sub_networks[i].serialize());
    }
  } else {
    for(var i=0;i<this.neurons.length;i++) {
      result.push(this.neurons[i].serialize());
    }
  }
  return result;
}

Network.deserialize_from_file = function(filename) {
  return Network.deserialize(JSON.parse(require("fs").readFileSync(filename)));
}

Network.deserialize = function(what, options, sub_network) {
  var result = new Network();

  for(var i=0;i<what.length;i++) {
    if(typeof(what[i]) == "Array") {
      result.add_sub_network(Network.deserialize(what[i], options, true));
    } else {
      var neuron = result.new_neuron(what[i]);
      neuron.id = what[i].id;
      if(!options || !options.exclude_connections) {
        neuron.proto_connections = what[i].connections;
      }
    }
  }

  if(!sub_network) {
    result.each_neuron(function(neuron) {
      if(neuron.proto_connections) {
        for(var i=0;i<neuron.proto_connections.length;i++) {
          var entry = neuron.proto_connections[i];
          var post_synaptic = result.get_neuron_by(entry.post_synaptic);
          neuron.connect(post_synaptic, entry.delay, entry.strength, entry.label);
        }

        delete neuron.proto_connections;
      }
    });
  }

  return result;
}

export_sym("Network", Network);



function Neuron(options) {
  this.gamma = options.gamma;
  this.I = options.I;
  this.initial_phase = options.initial_phase != undefined ? options.initial_phase : Math.random();
  this.partial_reset_factor = options.partial_reset_factor != undefined ? options.partial_reset_factor : 0.0;
  this.connections = [];
  this.partial_reset_potential = 0;
};

Neuron.prototype.initialize = function(current_time) {
  this.partial_reset_potential = 0;
  if(this.initial_phase == 0) {
    this.set_potential(current_time, 0);
  } else {
    this.set_phase(current_time, this.initial_phase);
  }
}

Neuron.prototype.reset = function(current_time) {
  this.set_potential(current_time, this.partial_reset_potential);
  this.partial_reset_potential = 0;
}

Neuron.prototype.next_reset = function() {
  if(this.I < this.gamma) {
    return;
  }
  return this.last_potential.time + Math.log( (this.I-this.gamma*this.last_potential.potential)/(this.I-this.gamma)  );
}

Neuron.prototype.current_phase = function(current_time) {
  return this.g(this.current_potential(current_time));
}

Neuron.prototype.current_potential = function(current_time) {
  return (1/this.gamma)*(this.I-(this.I-this.gamma*this.last_potential.potential)*Math.exp(-this.gamma*(current_time-this.last_potential.time)) );
}

Neuron.prototype.set_potential = function(current_time, potential) {
  this.last_potential = {time: current_time, potential: potential};
}

Neuron.prototype.set_phase = function(current_time, phase) {
  this.set_potential(current_time, this.f(phase));
};

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
  var new_potential = strength+this.current_potential(current_time);
  if(new_potential > 1) {
    this.partial_reset_potential = (new_potential-1)*this.partial_reset_factor;
    this.set_potential(current_time, this.partial_reset_potential);
    return true;
  } else {
    this.set_potential(current_time, new_potential);
    return false;
  }
}

Neuron.prototype.receive_phase_shift = function(current_time, phase_shift) {
  var new_potential = this.f(this.current_phase(current_time)+phase_shift);
  if(isNaN(new_potential) || new_potential > 1) {
    this.set_potential(current_time, 0);
    return true;
  } else {
    this.set_potential(current_time, new_potential);
    return false;
  }
}

Neuron.prototype.update_properties = function(current_time, options) {
  this.set_potential(current_time, this.current_potential(current_time));

  for(k in options) {
    this[k] = options[k];
  }
}

Neuron.prototype.phase_jump = function(current_phase, strength) {
  return this.g(strength + this.f(current_phase));
}

Neuron.prototype.T = function() {
  if(this.I < this.gamma) {
    return;
  }
  return Math.log(this.I/(this.I-this.gamma))/this.gamma;
}

Neuron.prototype.f = function(phase) {
  return this.I/this.gamma * (1 - Math.exp(-(phase*this.gamma*this.T())));
},

Neuron.prototype.g = function(potential) {
  return (1/(this.T()*this.gamma)) * Math.log(this.I/(this.I-this.gamma*potential));
}

Neuron.prototype.serialize = function() {
  var result = {
    id: this.id,
    I: this.I,
    gamma: this.gamma,
    initial_phase: this.initial_phase
  };

  if(this.connections.length > 0) {
    result.connections = [];
    for(var i=0;i<this.connections.length;i++) {
      var entry = {
        post_synaptic: this.connections[i].post_synaptic.id,
        delay: this.connections[i].delay,
        strength: this.connections[i].strength
      }
      if(this.connections[i].label) {
        entry.label = this.connections[i].label;
      }
      result.connections.push(entry);
    }
  }

  return result;
}

export_sym("Neuron", Neuron);



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
  if(this.options.sender) {
    result += ("\tsender: " + this.options.sender.id);
  }
  if(this.options.senders) {
    result += "\tsenders:"
    for(var i=0;i<this.options.senders.length;i++) {
      result += (" "+this.options.senders[i].id);
    }
  }
  return result;
}

export_sym("Event", Event);


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
    return a.time-b.time;
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

PoissonNoiseGenerator.prototype.before_noise = function(simulator, options) {
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

export_sym("PoissonNoiseGenerator", PoissonNoiseGenerator);


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
      this.combine_spikes(existing_event, event);
    } else {
      event_queue.add_event(event);
    }
  } else {
    event_queue.add_event(event);
  }
}

NetworkDynamicsObserver.prototype.combine_spikes = function(existing_event, new_event) {
  existing_event.options.strength += new_event.options.strength;
  if(existing_event.options.senders) {
    existing_event.options.senders.push(new_event.options.sender);
  } else {
    existing_event.options.senders = [existing_event.options.sender, new_event.options.sender]
    delete existing_event.options.sender;
  }
}

NetworkDynamicsObserver.prototype.event_initialize = function(simulator) {
  simulator.network.each_neuron(function(neuron) {
    neuron.initialize(simulator.current_time);
    var next_reset = neuron.next_reset();
    if(next_reset != undefined) {
      simulator.new_event(next_reset, "reset", {recipient: neuron});
    }
  });
}

NetworkDynamicsObserver.prototype.event_reset = function(simulator, options) {
  var neuron = options.recipient;
  neuron.reset(simulator.current_time);

  var next_reset = neuron.next_reset();
  if(next_reset != undefined) {
    simulator.new_event(next_reset, "reset", {recipient: neuron});
  }

  for (var i=0; i < neuron.connections.length; i++) {
    simulator.new_event(simulator.current_time+neuron.connections[i].delay, "spike", {
      sender: neuron,
      recipient: neuron.connections[i].post_synaptic,
      strength: neuron.connections[i].strength,
      label: neuron.connections[i].label
    });
  }
}

NetworkDynamicsObserver.prototype.remove_reset_event = function(simulator, neuron) {
  var reset_event_index = simulator.event_queue.find_next_event_index(function(evt) {
    return evt.type == "reset" && evt.options.recipient == neuron;
  });
  if(reset_event_index != undefined) {
    simulator.event_queue.remove_indexed_event(reset_event_index);
  }
}

NetworkDynamicsObserver.prototype.interact_with_neuron = function(simulator, options, callback) {
  this.remove_reset_event(simulator, options.recipient);

  // because of rounding errors the effect of a spike causing a reset needs to be handled explicitly
  if(callback()) {
    simulator.propagate_event("reset", { recipient: options.recipient });
  } else {
    var next_reset = options.recipient.next_reset();
    if(next_reset != undefined) {
      simulator.new_event(next_reset, "reset", {recipient: options.recipient});
    }
  }
}

NetworkDynamicsObserver.prototype.event_properties = function(simulator, options) {
  this.remove_reset_event(simulator, options.recipient);

  options.recipient.update_properties(simulator.current_time, options.options);

  var next_reset = options.recipient.next_reset();
  if(next_reset != undefined) {
    simulator.new_event(next_reset, "reset", {
      recipient: options.recipient
    });
  }
}

NetworkDynamicsObserver.prototype.event_phase_shift = function(simulator, options) {
  this.interact_with_neuron(simulator, options, function() {
    return options.recipient.receive_phase_shift(simulator.current_time, options.phase_shift);
  });
}

NetworkDynamicsObserver.prototype.event_spike = function(simulator, options) {
  this.interact_with_neuron(simulator, options, function() {
    return options.recipient.receive_spike(simulator.current_time, options.strength);
  });
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
  // call before event observers
  for(var j=0;j<this.observers.length;j++) {
    if(typeof(this.observers[j]["before_"+type]) == "function") {
      this.observers[j]["before_"+type](this, options);
    }
  }

  this.events_to_notify.push({type: type, options: options});

  // make sure dynamics happen after the observers, otherwise the
  // events propagated to the observers might be in the wrong order
  // ie. if a spike causes reset, the spike event needs to be propagated
  // before the reset event
  if(typeof(this.dynamics["event_"+type]) == "function") {
    this.dynamics["event_"+type](this, options);
  }
}

Simulator.prototype.notify_observers = function() {
  for(var i=0;i<this.events_to_notify.length;i++) {
    var evt = this.events_to_notify[i];
    for(var j=0;j<this.observers.length;j++) {
      if(typeof(this.observers[j]["event_"+evt.type]) == "function") {
        this.observers[j]["event_"+evt.type](this, evt.options);
      }
    }
  }

  this.events_to_notify = [];
}

Simulator.prototype.initialize = function(network) {
  this.network = network;

  this.current_time = 0.0;
  this.event_queue.clear();
  this.past_events = [];
  this.events_to_notify = [];

  this.propagate_event("initialize");
  this.notify_observers();
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
    if(!event || event.time>this.current_time) {
      this.notify_observers();
    }

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

export_sym("Simulator", Simulator);
