var fs = require("fs"),
    util = require("./util.js");


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
  fs.writeFileSync(filename, this.collate_log());
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
  fs.writeFileSync(filename, this.collate_log());
}

ResetObserver.prototype.group_sync_events = function(delta) {
  if(this.log.length == 0) {
    return [];
  }

  delta = util.or_default(delta, 0.01);

  var result = [];
  result.push({time: this.log[0].time, ids: [this.log[0].neuron.id]})
  for(var i=1;i<this.log.length;i++) {
    if(Math.abs(result[result.length-1].time-this.log[i].time) < delta) {
      result[result.length-1].ids.push(this.log[i].neuron.id);
      result[result.length-1].ids.sort();
    } else {
      result.push({time: this.log[i].time, ids: [this.log[i].neuron.id]})
    }
  }
  return result;
}

ResetObserver.prototype.matching_synced_event = function(log, evt, expected, delta) {
  var result = [];
  for(var i=0;i<log.length;i++) {
    if(log[i].neuron != evt.neuron && Math.abs(log[i].time-evt.time) < delta) {
      result.push(log[i]);
    }
  }

  if(result.length == 1) {
    return result[0].neuron == expected;
  } else if(result.length == 0) {
    return expected == undefined;
  } else {
    return false
  }
}

ResetObserver.prototype.sync_rules_satisfied = function(rules, search_window, padding) {
  if(!padding)
    padding = 10;

  var to_search = this.log.slice(search_window[0], search_window[1]);
  var to_check  = to_search.slice(padding, -padding);

  var result = true;
  for(var i=0;i<to_check.length;i++) {
    var evt = to_check[i];
    if(!this.matching_synced_event(to_search, evt, rules[evt.neuron.id], 0.001)) {
      return false;
    }
  }
  return result;
}

exports.ResetObserver = ResetObserver;


function TimedPhaseObserver(options) {
  this.interval = options.interval;
  this.start_time = options.start_time ? options.start_time : 0;
  this.lookahead = 2;
}

TimedPhaseObserver.prototype.event_initialize = function(simulator) {
  var num_evts = this.lookahead / this.interval;
  for(var i=0;i<num_evts;i++) {
    simulator.new_event(this.start_time+i*this.interval, "tick");
  }
  this.log = [];
}

TimedPhaseObserver.prototype.event_tick = function(simulator) {
  var result = {};
  simulator.network.each_neuron(function(neuron) {
    result[neuron.id] = neuron.current_phase(simulator.current_time);
  });
  result["time"] = simulator.current_time;
  this.log.push(result);

  simulator.new_event(simulator.current_time+this.lookahead, "tick");
}

TimedPhaseObserver.prototype.collate_log = function() {
  var result = [];
  for(var i=0;i<this.log.length;i++) {
    var value = this.log[i];
    var line = value.time+"";
    for(k in value) {
      if(k!="time") {
        line += (","+k+","+value[k]);
      }
    }
    result.push(line);
  }
  return result.join("\n");
}

TimedPhaseObserver.prototype.write_to_file = function(filename) {
  fs.writeFile(filename, this.collate_log());
}

exports.TimedPhaseObserver = TimedPhaseObserver;
