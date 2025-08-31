#pragma once

#include "bitmap.h"
#include <stdint.h>

// Python-friendly interface for bitmap access
// Returns an array of neuron indices that have bits set in the bitmap
// The caller must free the returned array
int* bitmap_to_indices(const Bitmap *bm, int *count) {
  *count = bitmap_count(bm);
  if (*count == 0) return NULL;
  
  int *indices = (int*)malloc(sizeof(int) * (*count));
  int idx = 0;
  
  for (int i = 0; i < bm->n_neurons; i++) {
    if (bitmap_test(bm, i)) {
      indices[idx++] = i;
    }
  }
  
  return indices;
}

// Alternative: Export bitmap as raw bytes for Python to decode
// Returns the raw bitmap data as bytes
uint64_t* bitmap_get_raw_data(const Bitmap *bm, int *n_chunks) {
  *n_chunks = bm->n_chunks;
  return bm->bits;
}