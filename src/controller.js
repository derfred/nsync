var base = require("./base.js"),
    util = require('./util.js'),
    exec = require('child_process').exec,
    fs   = require("fs");

function Controller(options) {
  this.options = base.merge(Controller.default_options, options);
}

Controller.default_options = {
  node_bin: "node",
  threads: 4
}

Controller.prototype.param_processed = function(error, stdout, stderr) {
  if(error) {
    console.log(error.message)
  }
  if(this.params.length%10 == 0) {
    var remain_time = ((util.get_time()-this.start_time)/(this.total-this.params.length) * this.params.length)/1000/60;
    var mins = Math.floor(remain_time);
    var seconds = Math.round(60*(remain_time-mins));
    console.log(this.params.length+" remaining sets. ETA: "+mins+":"+seconds+" mins");
  }
  this.save_result(stdout, this.process_param.bind(this));
}

Controller.prototype.save_result = function(output, callback) {
  fs.write(this.output_file, output, null, 'utf8', callback);
}


Controller.prototype.run = function(params) {
  this.output_file = fs.openSync(this.options.output_file_name, "a");
  this.params = params;

  this.total = params.length;
  this.start_time = util.get_time();

  console.log("processing "+this.total+" parameter sets")
  for(var i=0;i<this.options.threads;i++) {
    this.process_param();
  }
}


Controller.prototype.process_param = function() {
  var param = this.params.pop();
  if(param) {
    var cmd_line = this.options.node_bin + " " + this.options.calc_file + " " + this.transform_param(param);
    exec(cmd_line, this.param_processed.bind(this));
  }
}

Controller.prototype.transform_param = function(param) {
  return this.options.transform(param);
}

exports["Controller"] = Controller;
