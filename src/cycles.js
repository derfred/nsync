var base = require("./base.js"),
    util = require("./util.js"),
    observers = require("./observers.js"),
    fs = require("fs");

function read_default_cycles(filename) {
  var input = util.array_remove(fs.readFileSync(filename).toString().split("\n"), "");
  if(input.length%3 != 0) {
    throw "Mega FAIL!";
  }

  var result={};
  for(var i=0;i<input.length/3;i++) {
    result[input[i*3]] = {
      "up":   input[i*3+1].split(" "),
      "down": input[i*3+2].split(" ")
    }
  }
  return result;
}

var default_cycles = read_default_cycles(__dirname+"/default_cycles");

function rotate(array, n) {
  var result = array.slice(0)
  result.unshift.apply(result, result.splice(n, result.length))
  return result;
}


function identify(group1, group2) {
  var result = ["c", "c", "c", "c", "c"];
  result[parseInt(group1[0])] = "b";
  result[parseInt(group1[1])] = "b";
  result[parseInt(group2[0])] = "a";
  result[parseInt(group2[1])] = "a";
  return result.join("");
}

function identify_saddles(groups) {
  var result = [];
  var type = "";
  for(var i=1;i<groups.length;i++) {
    if(groups[i].ids.length == 2 && groups[i-1].ids.length == 2) {
      var current = groups[i-1].ids.join("-")+" "+groups[i].ids.join("-");
      if(type != current) {
        result.push(identify(groups[i-1].ids, groups[i].ids))
        type = current;
      }
    }
  }
  return result;
}

function identify_cycle(saddles) {
  var last = saddles[saddles.length-1];
  if(last == undefined) {
    return [];
  } else {
    var result = [last];
    for(var i=saddles.length-2;i>0;i--) {
      if(saddles[i] != last) {
        result.push(saddles[i]);
      } else {
        break;
      }
    }
    return result.reverse();
  }
}

function same_cycle(cycle1, cycle2) {
  if(cycle1.length != cycle2.length) {
    return false;
  }

  for(var i=0;i<cycle1.length;i++) {
    if(cycle2.join("|") == rotate(cycle1, i).join("|")) {
      return true;
    }
  }

  return false;
}

function matches_klass(cycle, klass) {
  return same_cycle(cycle, default_cycles[klass].up) || same_cycle(cycle, default_cycles[klass].down);
}

function classify_input(setup) {
  var result = [];
  for(var i=0;i<setup.length;i++) {
    if(setup[i] > 2) {
      result.push(i+1);
    }
  }
  return result.join("");
}

function eliminate_duplicates(states) {
  var result = [];
  var present = {};
  for(var i=0;i<states.length;i++) {
    if(present[states[i].join("")] == undefined) {
      present[states[i].join("")] = true;
      result.push(states[i]);
    }
  }
  return result;
}

function states_for(template, values) {
  var result = eliminate_duplicates(util.array_permute(template));
  if(values) {
    for(var i=0;i<result.length;i++) {
      for(var j=0;j<result[i].length;j++) {
        result[i][j] = values[result[i][j]];
      }
    }
  }
  return result;
}

exports.states_for = states_for;

function inputs_for(N) {
  var result = [];
  for(var i=0;i<N;i++) {
    result.push(i+1);
  }
  return util.array_permute(result);
}

exports.inputs_for = inputs_for;

function wrap(attrib, values) {
  var result = [];
  for(var i=0;i<values.length;i++) {
    var setup = {};
    setup[attrib] = values[i];
    result.push(setup);
  }
  return result;
}

exports.wrap = wrap;

function cartesian_product(left, right) {
  var result = [];
  for(var i=0;i<left.length;i++) {
    for(var j=0;j<right.length;j++) {
      result.push([left[i], right[j]])
    }
  }
  return result;
}

exports.cartesian_product = cartesian_product;

function default_network_builder(setup, options) {
  var options = options || {};
  var strength = setup.strength || 0.025;
  var network = base.Network.fully_connected(5, {
    I: 1.04,
    gamma: 1,
    strength: strength,
    delay: 1.59,
    initial_phases: setup.initial
  });

  if(options.network_change) {
    options.network_change(network, setup);
  }

  return network;
}

function check_setup(setup, options) {
  var network = (options.network_builder||default_network_builder)(setup, options);
  var simulator = new base.Simulator(0);
  var ro = new observers.ResetObserver();
  simulator.add_observer(ro);
  simulator.initialize(network);

  if(setup.input) {
    var asym = setup.asymmetry || 8e-5;
    var base_current = setup.base_current || 1.04;
    for(var i=0;i<network.neurons.length;i++) {
      simulator.new_event(50, "properties", {
        recipient: network.neurons[i],
        options: { I: base_current+(setup.input[i]*asym) }
      });
    }
  }

  simulator.start(options.run_time||1500, function() {
    var groups = ro.group_sync_events(options.sync_time||0.01);
    var saddles = identify_saddles(groups);
    var cycle = identify_cycle(saddles);
    var klass = classify_input(setup.input);

    var result = {
      setup: setup,
      input_class: klass,
      cycle: cycle,
      saddles: saddles
    };

    if(matches_klass(cycle, klass)) {
      result.output_class = klass
    } else {
      for(k in default_cycles) {
        if(matches_klass(cycle, k)) {
          result.output_class = k;
        }
      }
    }

    options.callback(result);
  });
}

exports.check_setup = check_setup;

function default_filter(result) {
  return result.input_class != result.output_class;
}

function filter_setups(setups, options) {
  var changes = [];
  var callback = options.callback;

  function next_setup(result) {
    if((options.filter||default_filter)(result)) {
      changes.push(result);
    }

    var next = setups.pop();
    if(next) {
      check_setup(next, options);
    } else {
      callback(changes);
    }
  }

  options.callback = next_setup;
  check_setup(setups.pop(), options);
}

exports.filter_setups = filter_setups;
