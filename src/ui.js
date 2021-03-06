function unit_vector(x1, y1, x2, y2) {
  var distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

  return {
    x: (x2 - x1)/distance,
    y: (y2 - y1)/distance
  };
}


Raphael.fn.arrow = function (x1, y1, x2, y2, size) {
  // some magic numbers
  var opening_angle = 0.4 * Math.PI;
  var arm_length = size*5;

  var unit = unit_vector(x1, y1, x2, y2);
  unit.x = -unit.x;
  unit.y = -unit.y;

  // arm one is rotated in half the opening angle clockwise
  var arm_one_x = unit.x*arm_length * Math.cos(opening_angle/2) - unit.y*arm_length * Math.sin(opening_angle/2) + x2;
  var arm_one_y = unit.x*arm_length * Math.sin(opening_angle/2) + unit.y*arm_length * Math.cos(opening_angle/2) + y2;

  // arm two is rotated in half the opening angle counter clockwise
  var arm_two_x = unit.x*arm_length * Math.cos(-opening_angle/2) - unit.y*arm_length * Math.sin(-opening_angle/2) + x2;
  var arm_two_y = unit.x*arm_length * Math.sin(-opening_angle/2) + unit.y*arm_length * Math.cos(-opening_angle/2) + y2;

  return this.path("M"+x1+" "+y1+" L"+x2+" "+y2+" M"+arm_one_x+" "+arm_one_y+" L"+x2+" "+y2+" L"+arm_two_x+" "+arm_two_y).attr("stroke-width", size);
};

function $F(id) {
  return parseFloat($(id).val());
}



function Canvas(id) {
  this.ctx = document.getElementById(id).getContext("2d");
  this.width = this.ctx.canvas.width;
  this.height = this.ctx.canvas.height;
}

Canvas.prototype.padding = function() {
  return {
    horizontal: this.ctx.canvas.width*0.025,
    vertical: this.ctx.canvas.height*0.025
  };
}

Canvas.prototype.set_options = function(options) {
  if(options) {
    for(k in options) {
      this.ctx[k] = options[k];
    }
  }
}

Canvas.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.width, this.height);
}

Canvas.prototype.draw_racetrack_coordinate_system = function(network) {
  var stroke_width = 2;

  var padding = this.padding();

  this.arrow(padding.horizontal, this.height-padding.vertical, padding.horizontal, padding.vertical, {lineWidth: stroke_width});
  this.arrow(padding.horizontal, this.height-padding.vertical, this.width-padding.horizontal, this.height-padding.vertical, {lineWidth: stroke_width});

  var total = network.number_of_neurons();
  var spacing = (this.height - 2*padding.vertical)/total;
  network.each_neuron(function(neuron, i) {
    this.ctx.strokeText(neuron.id, padding.horizontal*0.35, (padding.vertical+(i+0.5)*spacing));

    // baseline for every neuron
    this.line(padding.horizontal, padding.vertical+(i+1)*spacing,
              this.width-2*padding.horizontal, padding.vertical+(i+1)*spacing,
              {lineWidth: 1, strokeStyle: "#ccc"});

    // tick mark on y-axis
    this.line(padding.horizontal*0.5, padding.vertical+(i+1)*spacing,
              padding.horizontal, padding.vertical+(i+1)*spacing,
              {lineWidth: stroke_width});
  }.bind(this));

  // this is the "now" line
  this.line(this.width-2*padding.horizontal, padding.vertical,
            this.width-2*padding.horizontal, this.height-padding.vertical,
            {lineWidth: stroke_width, strokeStyle: "#aaa"});
}

Canvas.prototype.draw_relative_phases_coordinate_system = function() {
  var stroke_width = 2;

  var padding = this.padding();

  this.arrow(padding.horizontal, this.height-padding.vertical, padding.horizontal, padding.vertical, {lineWidth: stroke_width});
  this.arrow(padding.horizontal, this.height-padding.vertical, this.width-3*padding.horizontal, this.height-padding.vertical, {lineWidth: stroke_width});

  // this is the "now" line
  this.line(this.width-4*padding.horizontal, padding.vertical,
            this.width-4*padding.horizontal, this.height-padding.vertical,
            {lineWidth: stroke_width, strokeStyle: "#aaa"});
}

Canvas.prototype.line = function(x1, y1, x2, y2, options) {
  this.ctx.save();
  this.ctx.beginPath();

  this.set_options(options);
  
  this.ctx.moveTo(x1, y1);
  this.ctx.lineTo(x2, y2);

  this.ctx.stroke();
  this.ctx.restore();
}

Canvas.prototype.arrow = function(x1, y1, x2, y2, options) {
  // some magic numbers
  var opening_angle = 0.4 * Math.PI;
  var arm_length = options.lineWidth*5;

  var unit = unit_vector(x1, y1, x2, y2);
  unit.x = -unit.x;
  unit.y = -unit.y;

  // draw main line
  this.line(x1, y1, x2, y2, options);

  // arm one is rotated in half the opening angle clockwise
  var arm_one_x = unit.x*arm_length * Math.cos(opening_angle/2) - unit.y*arm_length * Math.sin(opening_angle/2) + x2;
  var arm_one_y = unit.x*arm_length * Math.sin(opening_angle/2) + unit.y*arm_length * Math.cos(opening_angle/2) + y2;
  this.line(arm_one_x, arm_one_y, x2, y2, options);

  // arm two is rotated in half the opening angle counter clockwise
  var arm_two_x = unit.x*arm_length * Math.cos(-opening_angle/2) - unit.y*arm_length * Math.sin(-opening_angle/2) + x2;
  var arm_two_y = unit.x*arm_length * Math.sin(-opening_angle/2) + unit.y*arm_length * Math.cos(-opening_angle/2) + y2;
  this.line(arm_two_x, arm_two_y, x2, y2, options);
}

Canvas.prototype.rect = function(x1, y1, x2, y2, options) {
  this.ctx.save();
  this.ctx.beginPath();

  this.set_options(options);

  this.ctx.moveTo(x1, y1);
  this.ctx.lineTo(x2, y1);
  this.ctx.lineTo(x2, y2);
  this.ctx.lineTo(x1, y2);

  this.ctx.closePath();
  this.ctx.fill();
  this.ctx.restore();
}

Canvas.prototype.text = function(text, x, y, options) {
  this.ctx.save();
  this.set_options(options);

  this.ctx.fillText(text, x, y);

  this.ctx.restore();
}



function NetworkDrawer() {
  this.paper = Raphael("network", 320, 320);
  this.neuron_radius = 10;
  this.reset();
}

NetworkDrawer.prototype.reset = function() {
  this.paper.clear();
  this.neuron_nodes = {};
  this.neuron_locations = {};
}

NetworkDrawer.prototype.set_location_for = function(neuron, index, total, box) {
  var angle = index/total * 2 * Math.PI;
  var x = box.x + Math.sin(angle)    * (box.w*0.9)/2 + box.w/2;
  var y = box.y + (-Math.cos(angle)) * (box.h*0.9)/2 + box.h/2;
  this.neuron_locations[neuron.id] = {x: x, y:y};
}

NetworkDrawer.prototype.connecting_line_coords = function(pre_synaptic, post_synaptic) {
  var pre_location = this.neuron_locations[pre_synaptic.id];
  var post_location = this.neuron_locations[post_synaptic.id];

  var result = {
    x1: pre_location.x + this.neuron_radius,
    y1: pre_location.y + this.neuron_radius,
    x2: post_location.x + this.neuron_radius,
    y2: post_location.y + this.neuron_radius,
  };

  var unit = unit_vector(result.x1, result.y1, result.x2, result.y2);

  var shift = 3;
  result.x1 = result.x1 + (unit.x*(this.neuron_radius+shift)) + (unit.y*shift);
  result.y1 = result.y1 + (unit.y*(this.neuron_radius+shift)) - (unit.x*shift);

  result.x2 = result.x2 - (unit.x*(this.neuron_radius+shift)) + (unit.y*shift);
  result.y2 = result.y2 - (unit.y*(this.neuron_radius+shift)) - (unit.x*shift);

  return result;
}

NetworkDrawer.prototype.divisions_for = function(total) {
  if(total == 1) {
    return {x:1, y:1};
  } else {
    return {x: Math.ceil(total/2), y: 2};
  }
}

NetworkDrawer.prototype.box_for = function(index, total) {
  var divs = this.divisions_for(total);
  var height = this.paper.height/divs.y;
  var width = this.paper.width/divs.x;

  return {
    x: Math.floor(index/total)*width,
    y: (index%total)*height,
    w: width,
    h: height
  };
}

NetworkDrawer.prototype.draw = function(network) {
  var all_external_connections = [];
  var sub_networks = network.all_networks();
  for(var i=0;i<sub_networks.length;i++) {
    var external_connections = this.draw_network(sub_networks[i], this.box_for(i, sub_networks.length));
    all_external_connections.push(external_connections);
  }

  for(var i=0;i<all_external_connections.length;i++) {
    for(var j=0;j<all_external_connections[i].length;j++) {
      var connection = all_external_connections[i][j];
      var coords = this.connecting_line_coords(connection.pre_synaptic, connection.post_synaptic);
      this.paper.arrow(coords.x1, coords.y1, coords.x2, coords.y2, 1);
    }
  }
}

NetworkDrawer.prototype.draw_network = function(network, box) {
  var external_connections = [];
  for (var i=0; i < network.neurons.length; i++) {
    this.set_location_for(network.neurons[i], i, network.neurons.length, box);
    this.draw_neuron(network.neurons[i]);
  }

  for (var i=0; i < network.neurons.length; i++) {
    for (var j=0; j < network.neurons[i].connections.length; j++) {
      var connection = network.neurons[i].connections[j];
      if(connection.post_synaptic.network == network) {
        // internal connection
        var coords = this.connecting_line_coords(network.neurons[i],
                                                 network.neurons[i].connections[j].post_synaptic);
        this.paper.arrow(coords.x1, coords.y1, coords.x2, coords.y2, 1).attr("stroke", "#ccc");;
      } else {
        // external connection
        external_connections.push(connection);
      }
    }
  }

  return external_connections;
}

NetworkDrawer.prototype.draw_neuron = function(neuron) {
  var location = this.neuron_locations[neuron.id];
  var node = this.paper.circle(location.x+this.neuron_radius,
                               location.y+this.neuron_radius,
                               this.neuron_radius);
  node.attr("fill", "#fff");
  node.attr("stroke", "#f00");

  this.paper.text(location.x+this.neuron_radius, location.y+this.neuron_radius, neuron.id);

  this.neuron_nodes[neuron.id] = node;
};

NetworkDrawer.prototype.update = function(network, current_time) {
  
}

NetworkDrawer.prototype.redraw = function(network, current_time) {
  
}

NetworkDrawer.prototype.neuron_fired = function(neuron) {
  this.neuron_nodes[neuron.id].animate({
    "50%": {fill: "#f00"},
    "100%": {fill: "#fff"},
  }, 200);
}

NetworkDrawer.prototype.neuron_click = function(callback) {
  var distance = function(one, two) {
    return Math.sqrt(Math.pow(one.x - two.x, 2) + Math.pow(one.y - two.y, 2));
  };

  var neuron_locations = this.neuron_locations;
  var closest_neuron = false;
  this.paper.canvas.onclick = function(event) {
    var position = {
      x: event.pageX-$("network_holder").offsetLeft-6,
      y: event.pageY-$("network_holder").offsetTop-42
    };

    for(id in neuron_locations) {
      if(closest_neuron) {
        if(distance(closest_neuron.location, position) > distance(neuron_locations[id], position)) {
          closest_neuron = {id: id, location: neuron_locations[id]};
        }
      } else {
        closest_neuron = {id: id, location: neuron_locations[id]};
      }
    }

    if(closest_neuron) {
      callback(closest_neuron.id);
    }
  }
}



function PhaseDiagramDrawer() {
  this.canvas = new Canvas("phases_canvas");
  this.lookback_time = 5;
  this.reset();
}

PhaseDiagramDrawer.type = "phases";

PhaseDiagramDrawer.prototype.reset = function() {
  this.phase_data = {};
}

PhaseDiagramDrawer.prototype.clear = function(network) {
  this.canvas.clear();
  this.canvas.draw_racetrack_coordinate_system(network);
}

PhaseDiagramDrawer.prototype.calc_unit_time_width = function(padding) {
  return (this.canvas.width-3*padding.horizontal)/this.lookback_time;
}

PhaseDiagramDrawer.prototype.draw = function(network) {
  this.clear(network);

  network.each_neuron(function(neuron) {
    this.phase_data[neuron.id] = [];
  }.bind(this));
}

PhaseDiagramDrawer.prototype.update = function(network, current_time) {
  network.each_neuron(function(neuron) {
    this.write_phase(neuron.id, current_time, neuron.current_phase(current_time));
  }.bind(this));
}

PhaseDiagramDrawer.prototype.redraw = function(network, current_time) {
  this.clear(network);

  var padding = this.canvas.padding();
  var spacing = (this.canvas.height - 2*padding.vertical)/network.number_of_neurons();

  var time_width = this.calc_unit_time_width(padding);
  var now = this.canvas.width-2*padding.horizontal;

  var coords_for = function(data_point, i) {
    return {
      x: now-((current_time-data_point.time)*time_width),
      y: padding.vertical+(i+1-data_point.phase)*spacing
    };
  };

  this.canvas.ctx.save();

  network.each_neuron(function(neuron, i) {
    var phase_data = this.phase_data[neuron.id];
    if(phase_data.length > 0) {
      var initial = coords_for(phase_data[phase_data.length-1], i);
      this.canvas.ctx.moveTo(initial.x, initial.y);

      for(var j=phase_data.length-2; j >= 0; j--) {
        var coords = coords_for(phase_data[j], i);
        if(coords.x > padding.horizontal) {
          this.canvas.ctx.lineTo(coords.x, coords.y);
        }
      }
    }
  }.bind(this));

  this.canvas.ctx.stroke();
  this.canvas.ctx.restore();
}

PhaseDiagramDrawer.prototype.write_phase = function(neuron_id, current_time, phase) {
  this.phase_data[neuron_id].push({
    time: current_time,
    phase: phase
  });

  while(this.phase_data[neuron_id][0].time < (current_time-this.lookback_time)) {
    this.phase_data[neuron_id].shift();
  }
}

PhaseDiagramDrawer.prototype.neuron_fired = function(neuron, current_time) {
  this.write_phase(neuron.id, current_time, 1);
  this.write_phase(neuron.id, current_time, 0);
}



function SpikeDiagramDrawer() {
  this.canvas = new Canvas("spikes_canvas");
  this.lookback_time = 5;
  this.reset();
}

SpikeDiagramDrawer.type = "spikes";

SpikeDiagramDrawer.prototype.reset = function() {
  this.spike_data = {};
}

SpikeDiagramDrawer.prototype.clear = function(network) {
  this.canvas.clear();
  this.canvas.draw_racetrack_coordinate_system(network);
}

SpikeDiagramDrawer.prototype.draw = function(network) {
  this.clear(network);

  network.each_neuron(function(neuron) {
    this.spike_data[neuron.id] = [];
  }.bind(this));
}

SpikeDiagramDrawer.prototype.calc_unit_time_width = function(padding) {
  return (this.canvas.width-3*padding.horizontal)/this.lookback_time;
}

SpikeDiagramDrawer.prototype.update = function(network, current_time) {

}

SpikeDiagramDrawer.prototype.redraw = function(network, current_time) {
  this.clear(network);

  var padding = this.canvas.padding();
  var spacing = (this.canvas.height - 2*padding.vertical)/network.number_of_neurons();

  var time_width = this.calc_unit_time_width(padding);
  var now = this.canvas.width-2*padding.horizontal;

  network.each_neuron(function(neuron, i) {
    var spike_data = this.spike_data[neuron.id];
    for (var j=0; j < spike_data.length; j++) {
      var data_point = spike_data[j];
      var x = now-((current_time-data_point)*time_width);
      if(x > padding.horizontal) {
        this.canvas.line(x, padding.vertical+(i+0.1)*spacing,
                         x, padding.vertical+(i+0.9)*spacing);
      }
    }
  }.bind(this));
}

SpikeDiagramDrawer.prototype.neuron_fired = function(neuron, current_time) {
  this.spike_data[neuron.id].push(current_time);

  while(this.spike_data[neuron.id][0] < current_time-this.lookback_time) {
    this.spike_data[neuron.id].shift();
  }
}



function PhaseDifferenceDiagramDrawer() {
  this.canvas = new Canvas("phase_differences_canvas");
  this.lookback_time = 5;
  this.colors = ["#ff0000", "#00ff00", "#0000ff", "#ff00ff", "#ffff00", "#00ffff"];
  this.reset();
}

PhaseDifferenceDiagramDrawer.type = "phase_differences";

PhaseDifferenceDiagramDrawer.prototype.reset = function() {
  this.phase_data = {};
}

PhaseDifferenceDiagramDrawer.prototype.clear = function(network) {
  this.canvas.clear();
  this.canvas.draw_relative_phases_coordinate_system(network);
}

PhaseDifferenceDiagramDrawer.prototype.draw = function(network) {
  this.clear(network);

  for (var i=1; i < network.neurons.length; i++) {
    this.phase_data[network.neurons[i].id] = [];
  };
}

PhaseDifferenceDiagramDrawer.prototype.redraw = function(network, current_time) {
  this.clear(network);

  var padding = this.canvas.padding();
  var height = this.canvas.height - padding.vertical;

  var time_width = this.calc_unit_time_width(padding);
  var now = this.canvas.width-4*padding.horizontal;

  var coords_for = function(data_point) {
    return {
      x: now-((current_time-data_point.time)*time_width),
      y: height*(1-data_point.phase_delta)
    };
  };

  this.canvas.ctx.save();
  for (var i=1; i < network.neurons.length; i++) {
    this.canvas.rect(this.canvas.width-(2.5*padding.horizontal),
                     (i-1)*2*padding.horizontal+padding.vertical,
                     this.canvas.width-(0.5*padding.horizontal),
                     (i)*2*padding.horizontal+padding.vertical,
                     {fillStyle: this.colors[(i-1)%this.colors.length]});
    this.canvas.text(network.neurons[i].id,
                     this.canvas.width-(1.5*padding.horizontal),
                     (i-0.25)*2*padding.horizontal+padding.vertical,
                     {fillStyle: "black", textAlign: "center", font: "15px sans-serif"});

    this.canvas.ctx.strokeStyle = this.colors[(i-1)%this.colors.length];
    this.canvas.ctx.lineWidth = 1;

    this.canvas.ctx.beginPath();

    var phase_data = this.phase_data[network.neurons[i].id];
    if(phase_data.length > 0) {
      var initial = coords_for(phase_data[phase_data.length-1])
      this.canvas.ctx.moveTo(initial.x, initial.y);

      for(var j=phase_data.length-2; j >= 0; j--) {
        var coords = coords_for(phase_data[j]);
        if(coords.x > padding.horizontal) {
          this.canvas.ctx.lineTo(coords.x, coords.y);
        }
      }
    }

    this.canvas.ctx.stroke();
  }
  this.canvas.ctx.restore();
}

PhaseDifferenceDiagramDrawer.prototype.update = function(network, current_time) {
  if(network.neurons.length == 0) {
    return;
  }

  var reference = network.neurons[0].current_phase(current_time);
  for (var i=1; i < network.neurons.length; i++) {
    var phase_delta = Math.abs(reference - network.neurons[i].current_phase(current_time));
    this.write_phase(network.neurons[i].id, current_time, phase_delta);
  };
}

PhaseDifferenceDiagramDrawer.prototype.write_phase = function(neuron_id, current_time, phase_delta) {
  this.phase_data[neuron_id].push({
    time: current_time,
    phase_delta: phase_delta
  });

  while(this.phase_data[neuron_id][0].time < (current_time-this.lookback_time)) {
    this.phase_data[neuron_id].shift();
  }
}

PhaseDifferenceDiagramDrawer.prototype.calc_unit_time_width = function(padding) {
  return (this.canvas.width-3*padding.horizontal)/this.lookback_time;
}

PhaseDifferenceDiagramDrawer.prototype.neuron_fired = function(neuron, current_time) {
  
}



function Drawer() {
  this.network_drawer = new NetworkDrawer();
  this.drawers = [
    this.network_drawer,
    new PhaseDiagramDrawer(),
    new SpikeDiagramDrawer(),
    new PhaseDifferenceDiagramDrawer()
  ];
  this.redraw_interval = 0.01;
  this.register_tab_switcher();
}

Drawer.prototype.each_drawer = function(callback) {
  for(var i=0;i<this.drawers.length;i++) {
    callback(this.drawers[i]);
  }
}

Drawer.prototype.reset = function() {
  this.each_drawer(function(drawer) {
    drawer.reset();
  });
}

Drawer.prototype.draw = function(network) {
  this.each_drawer(function(drawer) {
    drawer.draw(network);
  });
}

Drawer.prototype.redraw = function(network, current_time) {
  var current_tab = this.current_tab;
  this.each_drawer(function(drawer) {
    drawer.update(network, current_time);
    if(drawer.constructor.type == current_tab) {
      drawer.redraw(network, current_time);
    }
  });
}

Drawer.prototype.neuron_fired = function(neuron, current_time) {
  this.each_drawer(function(drawer) {
    drawer.neuron_fired(neuron, current_time);
  });
}

Drawer.prototype.neuron_click = function(callback) {
  this.network_drawer.neuron_click(callback);
}

Drawer.prototype.register_tab_switcher = function() {
  drawer = this;
  $("#graph_holder .tabs a").click(function(e) {
    e.preventDefault();
    drawer.current_tab = $(this).attr("href").replace("#", "");
  });
  this.current_tab = "spikes";
}

Drawer.prototype.event_initialize = function(simulator) {
  this.reset();
  this.draw(simulator.network);
  simulator.new_event(this.redraw_interval, "redraw");
}

Drawer.prototype.event_spike = function(simulator) {
  this.redraw(simulator.network, simulator.current_time);
}

Drawer.prototype.event_reset = function(simulator, options) {
  this.neuron_fired(options.recipient, simulator.current_time);
}

Drawer.prototype.event_redraw = function(simulator) {
  this.redraw(simulator.network, simulator.current_time);
  simulator.new_event(simulator.current_time + this.redraw_interval, "redraw");
}
