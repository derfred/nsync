nsync - event based neural network simulator for pulse coupled neurons
======================================================================

This package implements a JavaScript based simulator for the pulse coupled neural networks with delay as introduced in:

> U. Ernst, K. Pawelzik, and T. Geisel. Synchronization induced by temporal
> delays in pulse-coupled oscillators. Phys. Rev. Lett., 74, 1995.
> http://www.nld.ds.mpg.de/downloads/publications/p1570_1.pdf

Includes some basic visualization and the ability to interactively perturb individual neurons.

1. Download
2. Open examples/html/index.html in a modern browser (tested in Firefox 3.5 and Chrome 6)
3. pure bliss


Run Tests in Browser
--------------------

Open tests/index.html in a modern browser


Run Tests in node.js
--------------------

1. install kof/node-qunit
2. cli -c src/base.js -t tests/test_base.js
