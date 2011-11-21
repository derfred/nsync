var fs = require("fs");

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
  console.log(y*this.width, this.width)
  console.log(this.pixels.length)
  return this.pixels.slice(y*this.width, y*this.width+this.width);
}

GrayScaleImage.prototype.col = function(x) {
  var result = [];
  for(var i=0;i<this.height;i++) {
    result.push(this.pixels[i*this.width+x]);
  }
  return result;
}

exports.GrayScaleImage = GrayScaleImage;
