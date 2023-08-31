import subprocess, multiprocessing, tqdm
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
  nsync_process = subprocess.Popen(['./nsync', "50", str(delay), str(strength)], stdout=subprocess.PIPE, universal_newlines=True)

  data = []

  # Read and parse the output
  for line in nsync_process.stdout:
    values    = line.strip().split('\t')
    timestamp = float(values[0])
    phases    = [float(phase) for phase in values[1:]]
    
    if 0.0 in phases:
      resets = [i for i, x in enumerate(phases) if x == 0.0]
      data.append((timestamp, resets))

  nsync_process.stdout.close()
  nsync_process.wait()

  return data[:-1]

def find_density(trials, delay, strength):
  result = defaultdict(int)
  for _ in range(trials):
    data = simulate(delay, strength)
    result[find_symmetry([l[1] for l in data[-20:]])] += 1
  return result

def process_cell(i, j, side_len):
  delay    = 0.25 + 0.125 * (i / side_len)
  strength = 0.0625  * (j / side_len)
  density  = find_density(side_len, delay, strength)["2-3"]
  return (i, j, density)

def main():
  side_len  = 100
  num_cores = multiprocessing.cpu_count()
  pool      = multiprocessing.Pool(processes=num_cores)

  results = []
  for i in range(side_len):
    for j in range(side_len):
      results.append(pool.apply_async(process_cell, args=(i, j, side_len)))

  pool.close()
  pool.join()

  data = [[None] * side_len for _ in range(side_len)]
  for result in results:
    i, j, density = result.get()
    data[i][j] = density

  data_array = np.array(data)
  plt.imshow(data_array, cmap='hot', interpolation='nearest')
  plt.colorbar(label='Density')
  plt.xlabel('Strength')
  plt.ylabel('Delay')
  plt.title('Density Heatmap')
  plt.show()

if __name__ == "__main__":
  #r = process_cell(61, 8, 100)
  #print(r)
  main()
