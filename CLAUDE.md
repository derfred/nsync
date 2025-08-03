# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Usage
see @README.md

## Build Commands

```bash
# Build the C binary
make

# Build the cross-compiled Linux binary (requires Docker)
make cross

# Clean build artifacts
make clean

# Run the C binary
./build/nsync

# Run Python interface
python nsync/__init__.py
```

## Python Package Management

```bash
# Install dependencies using uv
uv sync

# Run Python code with dependencies
uv run python nsync/__init__.py

# Install package in development mode
uv add --dev pytest  # if you need to add testing
```

## Architecture Overview

This is a neural network simulator implementing pulse-coupled neural networks with delay. The codebase has both C and Python components:

### Core Components

**C Implementation (`nsync/` directory):**
- `nsync.c` - Main C program entry point
- `nsync_core.c/h` - Core simulation logic and network dynamics
- `nsync_lib.c/h` - Library interface for Python binding
- `config.c` - Configuration and argument parsing

**Python Interface (`nsync/__init__.py`):**
- `NetworkSimulation` class - Python wrapper using ctypes to interface with C library
- Automatic compilation of C code into shared library (`libnsync.so`)
- Methods for running simulations, extracting spikes, and analyzing results

Example usage:

```python
sim = NetworkSimulation()

result = sim.run_simulation(
    N=5,
    Tmax=100.0,
    strength=0.025,
    delay=1.59,
    I=1.04
)
```

### Key Architecture Patterns

1. **Hybrid C/Python Design**: Computationally intensive simulation runs in C, while data analysis and ease-of-use features are in Python
2. **Automatic Compilation**: Python interface automatically compiles C library if needed or if source files change
3. **Event-Based Simulation**: Uses event queues for precise timing of spikes and resets
4. **Dual Event Types**: Distinguishes between natural resets and spike-induced resets for detailed analysis

### Simulation Parameters

- `N` - Number of neurons
- `Tmax` - Simulation duration
- `delay` - Spike transmission delay
- `strength` - Coupling strength (positive for excitatory, negative for inhibitory)
- `I` - Base driving current
- `Ijitter` - Current variation between neurons
- `seed` - Random seed for reproducibility
- `initial_phases` - Optional array of starting phases (0-1) for each neuron

### Testing

The python tests are in the `tests/` directory, using pytest.

## Development Workflow

1. Modify C source files in `nsync/` directory
2. Python interface will automatically recompile shared library on next use
3. Test using the example code in `nsync/__init__.py` or create custom simulation scripts

## Important Notes

- The Python interface handles memory management between Python and C
- Simulation results include detailed event tracking (spikes, natural resets, spike-induced resets)
- The codebase implements numerically exact integration for precise temporal dynamics
- Cross-compilation for Linux is available via Docker for deployment
- Indent the code with 2 spaces

# Physics

The system simulated by this code is interesting because it naturally exhibits partial synchronization. The synchrony can be regular or irregular, depending on the parameters. In the regular cases the system settles into periodic attractor states that are characterized by their permutation symmetry (ie S2×S2×S1 which contains 2 groups of 2 neurons and 1 singleton). These states can be unstable or stable, depending on the parameters. The unstable states are linked into a heteroclinic network as each state is partially embedded in the attractor basin of another state.



