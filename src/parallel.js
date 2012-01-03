var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var workers = [];

function default_next(work_object) {
  return work_object.work.pop();
}

exports.parallelize = function(work_object) {
  if(cluster.isMaster) {
    for (var i = 0; i < numCPUs; i++) {
      var worker = cluster.fork()
      worker.on("message", function(m) {
        if(m.cmd == "done") {
          work_object.add_result(m.result);
        }

        if(m.cmd == "online" || m.cmd == "done") {
          var worker = workers[m._workerId-1];
          var param = (work_object.next||default_next)(work_object);
          if(param != undefined) {
            worker.send({ cmd: "process", param: param })
          } else {
            worker.send({ cmd: "quit" })
          }
        }
      });
      workers.push(worker);
    }
    process.on("exit", function() {
      work_object.complete();
    });
  } else {
    console.log("worker", process.env.NODE_WORKER_ID, "started", process.pid);
    process.on("message", function(m) {
      if(m.cmd == "process") {
        work_object.process(m.param, function(result) {
          process.send({
            cmd: "done",
            result: result,
            "_workerId": parseInt(process.env.NODE_WORKER_ID)
          });
        });
      } else if(m.cmd == "quit") {
        process.exit(0);
      }
    });
  }
}
