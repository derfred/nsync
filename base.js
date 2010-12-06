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

export("merge", merge);


function Network() {
  this.neurons = [];
  this.connections = {};
}

Network.default_options = {
  delay: 0.3,
  strength: 0.023,
  C: 1.04,
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

    var neuron = new Neuron({
      C: options.C,
      gamma: options.gamma,
      initial_phase: initial_phase
    });
    network.add_neuron(neuron);
  };

  for (var i=0; i < network.neurons.length; i++) {
    for (var j=0; j < network.neurons.length; j++) {
      if (j != i) {
        network.connect(network.neurons[i], network.neurons[j], options.delay, options.strength);
      }
    };
  };

  return network;
}

Network.prototype.add_new_neuron = function(options) {
  var neuron = new Neuron(options);
  this.add_neuron(neuron);
  return neuron;
}

Network.prototype.add_neuron = function(neuron) {
  neuron.id = this.neurons.length;
  neuron.network = this;
  this.neurons.push(neuron);

  this.connections[neuron.id] = [];
};

Network.prototype.connect = function(pre_synaptic, post_synaptic, delay, strength) {
  this.connections[pre_synaptic.id].push({
    neuron: post_synaptic,
    delay: delay,
    strength: strength
  });
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
  this.C = options.C;
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

Neuron.prototype.post_synaptic_neurons = function() {
  return this.network.connections[this.id];
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

Neuron.prototype.f = function(phase, options) {
  return this.C * (1-Math.exp(-this.gamma*phase));
},

Neuron.prototype.g = function(x, options) {
  return (1/this.gamma) * Math.log(this.C/(this.C-x));
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
  this.events.sort(function(a, b) { return a.time-b.time; });
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



function Simulator(time_factor) {
  this.event_queue = new EventQueue();

  this.time_factor = time_factor != undefined ? time_factor : 1000;
  this.redraw_interval = 0.01;
}

Simulator.prototype.initialize = function(network, drawer) {
  this.network = network;
  this.drawer = drawer;

  this.current_time = 0.0;
  this.event_queue.clear();
  this.past_events = [];

  if(this.drawer) {
    this.drawer.reset();
    this.drawer.draw(network);
  }

  for (var i=0; i < this.network.neurons.length; i++) {
    var neuron = this.network.neurons[i];
    neuron.initialize(this.current_time);
    this.event_queue.add_event(new Event(neuron.next_reset(this.current_time), "reset", {recipient: neuron}));
  };

  if(this.drawer) {
    this.event_queue.add_event(new Event(this.redraw_interval, "redraw"));
  }
}

Simulator.prototype.neuron_reset = function(neuron) {
  if(this.drawer) {
    this.drawer.neuron_fired(neuron, this.current_time);
  }

  var next_reset = neuron.next_reset(this.current_time);
  this.event_queue.add_event(new Event(next_reset, "reset", {recipient: neuron}));

  var post_synaptic_neurons = neuron.post_synaptic_neurons();
  for (var i=0; i < post_synaptic_neurons.length; i++) {
    this.event_queue.add_event(new Event(this.current_time+post_synaptic_neurons[i].delay, "spike", {
      sender: neuron,
      recipient: post_synaptic_neurons[i].neuron,
      strength: post_synaptic_neurons[i].strength
    }));
  }
}

Simulator.prototype.event_reset = function(event) {
  var recipient = event.options.recipient;
  recipient.reset(this.current_time);
  this.neuron_reset(recipient);
}

Simulator.prototype.event_redraw = function(event) {
  this.drawer.redraw(this.network, this.current_time);
  this.event_queue.add_event(new Event(this.current_time + this.redraw_interval, "redraw"));
}

Simulator.prototype.event_spike = function(event) {
  if(this.drawer) {
    this.drawer.redraw(this.network, this.current_time);
  }

  var reset_event_index = this.event_queue.find_next_event_index(function(evt) {
    return evt.type == "reset" && evt.options.recipient == event.options.recipient;
  });
  if(reset_event_index != undefined) {
    this.event_queue.remove_indexed_event(reset_event_index);
  }

  // because of rounding errors the effect of a spike causing a reset needs to be handled explicitly
  var fired = event.options.recipient.receive_spike(this.current_time, event.options.strength);
  if(fired) {
    this.neuron_reset(event.options.recipient);
  } else {
    var next_reset = event.options.recipient.next_reset(this.current_time);
    this.event_queue.add_event(new Event(next_reset, "reset", {recipient: event.options.recipient}));
  }
}

Simulator.prototype.event_stop = function(event) {
  this.event_queue.clear();
  if(event.options.callback) {
    setTimeout(event.options.callback, 10);
  }
  return false;
}

Simulator.prototype.execute_event = function(evt) {
  // this slows the simulation so that it is observable
  this.execute_timed(evt, function(event) {
    if(this.save_events) {
      this.past_events.push(event);
    }

    this["event_"+event.type](event);

    var event = this.event_queue.pop_next_event();
    if(event) {
      this.execute_event(event);
    }
  });
}

Simulator.prototype.execute_timed = function(event, callback) {
  var self = this;
  this.next_event_time = event.time;
  setTimeout(function() {
    self.current_time = event.time;
    callback.apply(self, [event]);
  }, this.wait_time(event));
}

Simulator.prototype.wait_time = function(event) {
  if(event.time >= this.current_time) {
    var wait = event.time*this.time_factor + this.real_start_time - (new Date()).getTime();
    return Math.max(wait, 1);
  } else {
    return 1;
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
