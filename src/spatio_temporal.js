var fs = require("fs"),
    util = require("./util.js");

// this klass can read .PGM files
function GrayScaleImage(file_name) {
  this.width = 0;
  this.height = 0;
  this.pixels = [];
  if(file_name != undefined) {
    this.readSync(file_name);
  }
}

GrayScaleImage.prototype.read = function(file_name, callback) {
  fs.readFile(file_name, "ASCII", function(err, data) {
    if (err) throw err;
    this._read(data);
    callback();
  }.bind(this));
}

GrayScaleImage.prototype.readSync = function(file_name) {
  this._read(fs.readFileSync(file_name, "ASCII"));
}

GrayScaleImage.prototype._read = function(data) {
  var lines = data.split("\n");

  if(lines[0] != "P2") throw "wrong file type"

  var line = 1;
  while(lines[line][0] == "#") {
    line++;
  }

  var dims = lines[line].split(" ");
  this.width = parseInt(dims[0]);
  this.height = parseInt(dims[1]);

  var max = parseInt(lines[line+1]);
  var total = this.width*this.height;
  var point = 0;
  while(point<total && line<lines.length) {
    var values = lines[line].split(" ");
    for(var j=0;j<values.length;j++) {
      if(point<total) {
        this.pixels.push(parseInt(values[j])/max);
        point++;
      }
    }
    line++;
  }
}

GrayScaleImage.prototype.get = function(x, y) {
  return this.pixels[y*this.width+x];
}

GrayScaleImage.prototype.row = function(y) {
  return this.pixels.slice(y*this.width, y*this.width+this.width);
}

GrayScaleImage.prototype.col = function(x) {
  var result = [];
  for(var i=0;i<this.height;i++) {
    result.push(this.pixels[i*this.width+x]);
  }
  return result;
}

GrayScaleImage.prototype.box_average = function(x, y, w, h) {
  var result = 0;
  for(var i=0;i<w;i++) {
    for(var j=0;j<h;j++) {
      result += this.get(x+i, y+j);
    }
  }
  return result/(w*h);
}


// this klass reads a grayscale image and uses it as specification of varying driving current
function ImageDriver(file_name, options) {
  this.image = new GrayScaleImage(file_name);
  options = util.merge(ImageDriver.defaults, options);
  this.start = options.start;
  this.box_width = options.box_width;
  this.time_factor = options.time_factor;

  if(this.image.width%this.box_width != 0) throw "image width not multiple of box_width"
}

ImageDriver.defaults = {
  start: 0,
  box_width: 1,
  time_factor: 5,
  base_current: 1.04,
  base_asymmetry: 0.001
}

ImageDriver.prototype.event_initialize = function(simulator, options) {
  var N = simulator.network.neurons.length;
  var box_height = this.image.height/N;
  var M = this.image.width/this.box_width;
  for(var i=0;i<N;i++) {
    for(var j=0;j<M;j++) {
      var value = this.image.box_average(j*this.box_width, i*box_height, this.box_width, box_height);
      simulator.new_event(this.start+j*this.time_factor, "properties", {
        I: this.base_current+value*this.base_asymmetry
      });
    }
  }
}

exports.ImageDriver = ImageDriver;
