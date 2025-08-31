#pragma once

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

// Bitmap structure for tracking neuron states
// Uses uint64_t array for efficient storage of arbitrary neuron counts
typedef struct {
  uint64_t *bits;
  int n_neurons;
  int n_chunks;  // Number of 64-bit chunks needed
} Bitmap;

// Initialize a bitmap for N neurons
static inline Bitmap* bitmap_create(int n_neurons) {
  Bitmap *bm = (Bitmap*)malloc(sizeof(Bitmap));
  bm->n_neurons = n_neurons;
  bm->n_chunks = (n_neurons + 63) / 64;  // Round up division
  bm->bits = (uint64_t*)calloc(bm->n_chunks, sizeof(uint64_t));
  return bm;
}

// Free bitmap memory
static inline void bitmap_free(Bitmap *bm) {
  if (bm) {
    free(bm->bits);
    free(bm);
  }
}

// Clear all bits
static inline void bitmap_clear(Bitmap *bm) {
  memset(bm->bits, 0, bm->n_chunks * sizeof(uint64_t));
}

// Set bit for neuron i
static inline void bitmap_set(Bitmap *bm, int i) {
  if (i >= 0 && i < bm->n_neurons) {
    int chunk = i / 64;
    int bit = i % 64;
    bm->bits[chunk] |= (1ULL << bit);
  }
}

// Clear bit for neuron i
static inline void bitmap_unset(Bitmap *bm, int i) {
  if (i >= 0 && i < bm->n_neurons) {
    int chunk = i / 64;
    int bit = i % 64;
    bm->bits[chunk] &= ~(1ULL << bit);
  }
}

// Test if bit for neuron i is set
static inline bool bitmap_test(const Bitmap *bm, int i) {
  if (i >= 0 && i < bm->n_neurons) {
    int chunk = i / 64;
    int bit = i % 64;
    return (bm->bits[chunk] & (1ULL << bit)) != 0;
  }
  return false;
}

// Check if bitmap is empty (no bits set)
static inline bool bitmap_is_empty(const Bitmap *bm) {
  for (int i = 0; i < bm->n_chunks; i++) {
    if (bm->bits[i] != 0) return false;
  }
  return true;
}

// Count number of set bits
static inline int bitmap_count(const Bitmap *bm) {
  int count = 0;
  for (int i = 0; i < bm->n_chunks; i++) {
    // Use builtin popcount if available for performance
    count += __builtin_popcountll(bm->bits[i]);
  }
  return count;
}

// Copy bitmap
static inline void bitmap_copy(Bitmap *dest, const Bitmap *src) {
  if (dest->n_chunks == src->n_chunks) {
    memcpy(dest->bits, src->bits, src->n_chunks * sizeof(uint64_t));
  }
}

// Bitwise OR (dest = dest | src)
static inline void bitmap_or(Bitmap *dest, const Bitmap *src) {
  int n = (dest->n_chunks < src->n_chunks) ? dest->n_chunks : src->n_chunks;
  for (int i = 0; i < n; i++) {
    dest->bits[i] |= src->bits[i];
  }
}

// Bitwise AND (dest = dest & src)
static inline void bitmap_and(Bitmap *dest, const Bitmap *src) {
  int n = (dest->n_chunks < src->n_chunks) ? dest->n_chunks : src->n_chunks;
  for (int i = 0; i < n; i++) {
    dest->bits[i] &= src->bits[i];
  }
}

// Bitwise AND-NOT (dest = dest & ~src)
static inline void bitmap_andnot(Bitmap *dest, const Bitmap *src) {
  int n = (dest->n_chunks < src->n_chunks) ? dest->n_chunks : src->n_chunks;
  for (int i = 0; i < n; i++) {
    dest->bits[i] &= ~src->bits[i];
  }
}

// Build string representation for debugging
static inline void bitmap_to_string(char *buffer, const Bitmap *bm, char klass) {
  buffer[0] = klass;
  buffer[1] = ':';
  for (int i = 0; i < bm->n_neurons; i++) {
    buffer[i + 2] = bitmap_test(bm, i) ? '1' : '0';
  }
  buffer[bm->n_neurons + 2] = '\0';
}