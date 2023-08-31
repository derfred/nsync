import subprocess
import matplotlib.pyplot as plt

# Run the nsync program and capture its stdout
nsync_process = subprocess.Popen(['./nsync'], stdout=subprocess.PIPE, universal_newlines=True)

# Initialize data storage
data = []

# Read and parse the output
for line in nsync_process.stdout:
    print(line)
    values = line.strip().split('\t')
    timestamp = float(values[0])
    phases = [float(phase) for phase in values[1:]]
    data.append((timestamp, phases))

# Close the nsync process
nsync_process.stdout.close()
nsync_process.wait()

# Extract timestamps and phases for plotting
timestamps, phases = zip(*data)

# Create a plot for each oscillator's phase over time
num_oscillators = len(phases[0])
for oscillator_idx in range(num_oscillators):
    oscillator_phases = [phase[oscillator_idx] for phase in phases]
    plt.plot(timestamps, oscillator_phases, label=f'Oscillator {oscillator_idx + 1}')

plt.xlabel('Timestamp')
plt.ylabel('Phase')
plt.title('Oscillator Phases over Time')
plt.legend()
plt.grid(True)
plt.show()
