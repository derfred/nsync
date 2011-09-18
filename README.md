nsync - event based neural network simulator for pulse coupled neurons
======================================================================

This package implements a JavaScript based simulator for pulse coupled neural networks with delay as introduced in:

> U. Ernst, K. Pawelzik, and T. Geisel. Synchronization induced by temporal
> delays in pulse-coupled oscillators. Phys. Rev. Lett., 74, 1995.
> http://www.nld.ds.mpg.de/downloads/publications/p1570_1.pdf

The algorithm is based on the concept of numerically exact integration as presented in:
> Rotter S and Diesmann M. Exact Digital Simulation of Time-Invariant Linear Systems
> with Applications to Neuronal Modeling. Biological Cybernetics 81:381-402 (1999)
> http://www.springerlink.com/content/08legf57tjkc6nj0 (no publically available version)


Includes some basic visualization and the ability to interactively perturb individual neurons.

1. Download
2. Open examples/html/index.html in a modern browser (tested in Firefox 3.5 and Chrome 6)
3. pure bliss


Batch simulations
-----------------

This package can also be run from the command line for batch simulation. See the examples/node directory for details. The command line mode requires node.js.


Run Tests in Browser
--------------------

Open tests/index.html in a modern browser


Run Tests in node.js
--------------------

1. install kof/node-qunit
2. cli -c ./src/base.js -t ./tests/test_base.js
