var base = require("./base.js");

function export(name, type) {
  if(typeof(exports) != "undefined") {
    exports[name] = type;
  }
}

function self_stabilizer(N, options) {
  var network = new base.Network();
  var left = network.add_sub_network(base.Network.fully_connected(5, {
    delay: options.intra_delay,
    strength: options.intra_strength
  }));
  var right = network.add_sub_network(base.Network.fully_connected(5, {
    delay: options.intra_delay,
    strength: options.intra_strength
  }));

  for(var i=0;i<5;i++) {
    left.neurons[i].connect(right.neurons[i], options.inter_delay, options.inter_strength);
    right.neurons[i].connect(left.neurons[i], options.inter_delay, options.inter_strength);
  }

  network.left = left;
  network.right = right;

  return network;
}

export("self_stabilizer", self_stabilizer);


function group_by(array, predicate) {
  var tmp = {};
  var keys = [];
  for(var i=0;i<array.length;i++) {
    var key = predicate(array[i]);
    if(tmp[key]) {
      tmp[key].push(array[i]);
    } else {
      tmp[key] = [array[i]];
      keys.push(key);
    }
  }

  var result = [];
  for(var i=0;i<keys.length;i++) {
    result.push(tmp[keys[i]]);
  }
  return result;
}

export("group_by", group_by);

function _map_method(array, method_or_property) {
  var result = [];
  for(var i=0;i<array.length;i++) {
    if(typeof(array[i][method_or_property]) == "function") {
      result.push(array[i][method_or_property]());
    } else {
      result.push(array[i][method_or_property]);
    }
  }
  return result;
}

function _map_function(array, fn) {
  var result = [];
  for(var i=0;i<array.length;i++) {
    result.push(fn(array[i]));
  }
  return result;
}


function map(array, method_or_property_or_function) {
  if(typeof(method_or_property_or_function) == "function") {
    return _map_function(array, method_or_property_or_function);
  } else {
    return _map_method(array, method_or_property_or_function);
  }
}

export("map", map);


function event_sender_string(event) {
  if(event.options.senders) {
    return map(event.options.senders, "id").join(",");
  } else {
    return event.options.sender.id;
  }
}

export("event_sender_string", event_sender_string);



function is_resetting(event, reset_observers) {
  var decider = function(log_event) {
    return log_event.time == event.time && log_event.neuron == event.options.recipient;
  }

  var result = false;
  for(var i=0;i<reset_observers.length;i++) {
    result = result || (reset_observers[i].find_in_log(decider) != undefined)
  }
  return result;
}

function split_events(events, reset_observers) {
  var reseting = [];
  var receiving = [];
  var receiving_and_resetting = [];

  for(var i=0;i<events.length;i++) {
    if(events[i].type == "reset") {
      reseting.push(events[i]);
    } else if(events[i].type == "spike" && (events[i].options.sender || events[i].options.senders)) {
      if(is_resetting(events[i], reset_observers)) {
        receiving_and_resetting.push(events[i]);
      } else {
        receiving.push(events[i]);
      }
    }
  }

  var sender_grouper = function(event) {
    return event_sender_string(event);
  };

  return {
    reseting: reseting,
    receiving: group_by(receiving, sender_grouper),
    receiving_and_resetting: group_by(receiving_and_resetting, sender_grouper)
  };
}

function recipients_for(events) {
  return map(events, function(event) { return event.options.recipient.id; });
}

function push_events(output, events, prefix) {
  if(events.length > 0) {
    for(var i=0;i<events.length;i++) {
      var sender_string = event_sender_string(events[i][0]);
      output.push("$"+prefix+"_{"+(recipients_for(events[i]).join(","))+"}("+sender_string+")$");
    }
  }
}

function print_event_table(simulator, reset_observers, from, to) {
  var result = {};
  var times = [];
  for(var i=0;i<simulator.past_events.length;i++) {
    var evt = simulator.past_events[i];
    if((evt.time > from && evt.time < to)) {
      if(!result[evt.time]) {
        times.push(evt.time);
        result[evt.time] = [evt]
      } else {
        result[evt.time].push(evt);
      }
    }

    
  }
  console.log("\\documentclass[a4paper,10pt]{article}");
  console.log("\\usepackage[landscape,left=1cm,top=1cm]{geometry}")
  console.log("\\begin{document}");
  console.log("\\Large{\\begin{tabular}{l|l}");
  console.log("time         & event \\\\");
  console.log("\\hline");

  for(var j=0;j<times.length;j++) {
    var evts = split_events(result[times[j]], reset_observers);

    var output = [];
    if(evts.reseting.length > 0) {
      output.push("$r_{"+(recipients_for(evts.reseting).join(","))+"}$");
    }

    push_events(output, evts.receiving, "s");
    push_events(output, evts.receiving_and_resetting, "s^*");

    if(output.length > 0) {
      console.log(times[j]+" & "+output.join(", ")+"\\\\");
    }
  }
  console.log("\\end{tabular}}")
  console.log("\\end{document}");
}

export("print_event_table", print_event_table);

function get_time() {
  return (new Date()).getTime();
}

export("get_time", get_time);
