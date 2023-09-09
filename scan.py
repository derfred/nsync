import subprocess, multiprocessing, tqdm, sys
from collections import defaultdict

import matplotlib.pyplot as plt
import numpy as np

def find_pattern(data, max_period=3, min_repeat=5):
  potential = [i for i in range(1, max_period+1) if data[-1] == data[-i-1]]
  if len(potential) == 0:
    return

  period = potential[0]
  for i in range(1, min_repeat):
    for j in range(period):
      if data[-i-j] != data[-i-j-period]:
        return

  return data[-period:]

def find_symmetry(data):
  pattern = find_pattern(data)
  if pattern is None:
    return
  return "-".join(sorted(str(len(p)) for p in pattern))

def simulate(delay, strength):
  command = ['./nsync', "150", str(delay), str(strength)]
  process = subprocess.Popen(command, stdout=subprocess.PIPE, universal_newlines=True)

  data = []

  # Read and parse the output
  for line in process.stdout:
    values    = line.strip().split('\t')
    timestamp = float(values[0])
    phases    = [float(phase) for phase in values[1:]]
    
    if 0.0 in phases:
      resets = [i for i, x in enumerate(phases) if x == 0.0]
      data.append((timestamp, resets))

  process.stdout.close()
  process.wait()

  return data[:-1]

def find_density(trials, delay, strength):
  result = defaultdict(int)
  for _ in range(trials):
    data = simulate(delay, strength)
    result[find_symmetry([l[1] for l in data[-20:]])] += 1
  return result

def test():
  print(find_density(10, 0.5, 1.5))
  # data = simulate(2.5, 0.05)
  # print(find_symmetry([l[1] for l in data[-20:]]))

def process_cell(i, j, delay, strength, side_len):
  densities = find_density(int(side_len/1), delay, strength)
  density = densities["1-2-2"] #* densities["2-3"]
  return (i, j, density)

def plot_area(x_offset, x_scale, y_offset, y_scale, side_len = 100):
  pool = multiprocessing.Pool()
  jobs = []
  for i in range(side_len):
    for j in range(side_len):
      x = x_offset + i / side_len * x_scale
      y = y_offset + j / side_len * y_scale
      jobs.append(pool.apply_async(process_cell, args=(i, j, x, y, side_len)))
  pool.close()

  data = [[None] * side_len for _ in range(side_len)]
  for result in tqdm.tqdm(jobs):
    i, j, density = result.get()
    data[i][j] = density

  data_array = np.array(data)
  plt.imshow(data_array, cmap='hot', interpolation='nearest')
  plt.colorbar(label='Density')
  plt.xlabel('Delay')
  plt.ylabel('Strength')
  x_ticks = np.linspace(x_offset, x_offset + x_scale, num=5)  # You can adjust the number of ticks as needed
  y_ticks = np.linspace(y_offset, y_offset + y_scale, num=5)
  plt.xticks(np.linspace(0, side_len - 1, num=5), x_ticks)
  plt.yticks(np.linspace(0, side_len - 1, num=5), y_ticks)
  plt.title('Density Heatmap')
  plt.show()

if __name__ == "__main__":
  mode = "plot"
  if len(sys.argv) > 1:
    mode = sys.argv[1]

  {
    "test": lambda: test(),
    "scan": lambda: print(find_density(100, 0.5, 1.5)),
    "plot": lambda: plot_area(0, 0.5, 0.1, 0.2, 100)
  }[mode]()
