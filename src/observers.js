var fs = require("fs");

function PoincareSectionObserver(options) {
  this.section_function = this.build_section_function(options);
  this.reset();
}

PoincareSectionObserver.prototype.reset = function() {
  this.log = [];
}

PoincareSectionObserver.prototype.build_section_function = function(options) {
  if(options && options.section_function) {
    return options.section_function;
  } else if(options && options.network) {
    return function(neuron) {
      return neuron.network == options.network && neuron == neuron.network.neurons[0];
    };
  } else if(options && options.neuron) {
    return function(neuron) {
      return neuron == options.neuron;
    };
  } else {
    return function(neuron) {
      return neuron == neuron.network.neurons[0];
    };
  }
}

PoincareSectionObserver.prototype.event_reset = function(simulator, options) {
  var current_time = simulator.current_time;
  var neuron = options.recipient;

  if(this.section_function(neuron, current_time)) {
    neuron.network.each_neuron(function(_neuron) {
      this.log.push({
        time: current_time,
        neuron: _neuron,
        phase: _neuron.current_phase(current_time)
      });
    }.bind(this));
  }
}

PoincareSectionObserver.prototype.collate_log = function() {
  var result = [];
  for(var i=0;i<this.log.length;i++) {
    result.push(this.log[i].neuron.id+","+this.log[i].time+","+this.log[i].phase);
  }
  return result.join("\n");
}

PoincareSectionObserver.prototype.write_to_file = function(filename) {
  fs.writeFile(filename, this.collate_log());
}

exports.PoincareSectionObserver = PoincareSectionObserver;




function ResetObserver(options) {
  this.selector_function = this.build_selector_function(options);
  this.reset();
}

ResetObserver.prototype.reset = function() {
  this.log = [];
}

ResetObserver.prototype.build_selector_function = function(options) {
  if(options && options.selector_function) {
    return options.selector_function;
  } else if(options && options.network) {
    return function(neuron) {
      return neuron.network == options.network;
    };
  } else if(options && options.neuron) {
    return function(neuron) {
      return neuron == options.neuron;
    };
  } else {
    return function(neuron) {
      return true;
    };
  }
}

ResetObserver.prototype.event_reset = function(simulator, options) {
  var neuron = options.recipient;
  var current_time = simulator.current_time;
  if(this.selector_function(neuron, current_time)) {
    this.log.push({neuron: neuron, time: current_time});
  }
}

ResetObserver.prototype.find_in_log = function(predicate) {
  for (var i=0; i < this.log.length; i++) {
    var log_event = this.log[i];
    if(predicate(log_event)) {
      return log_event;
    }
  };
}

ResetObserver.prototype.collate_log = function() {
  var result = [];
  for(var i=0;i<this.log.length;i++) {
    result.push(this.log[i].neuron.id+","+this.log[i].time);
  }
  return result.join("\n");
}

ResetObserver.prototype.write_to_file = function(filename) {
  fs.writeFile(filename, this.collate_log());
}

exports.ResetObserver = ResetObserver;

