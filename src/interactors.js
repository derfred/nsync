function export(name, type) {
  if(typeof(exports) != "undefined") {
    exports[name] = type;
  }
}

function PostResetPerturber(neuron, strength, time) {
  this.neuron = neuron;
  this.strength = strength;
  this.time = time;
  this.fired = false;
}

PostResetPerturber.prototype.event_reset = function(simulator, options) {
  if(!this.fired && options.recipient == this.neuron && this.time < simulator.current_time) {
    simulator.new_event(simulator.current_time, "spike", {
      recipient: this.neuron,
      strength: this.strength
    });
    this.fired = true;
  }
}

export("PostResetPerturber", PostResetPerturber);
