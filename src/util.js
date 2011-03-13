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
