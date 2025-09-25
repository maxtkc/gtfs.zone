import { test, expect } from '@playwright/test';
import { shortestCommonSupersequence, visualizeAlignment } from '../src/modules/scs.js';

test.describe('Shortest Common Supersequence', () => {
  test('should handle basic cases', async () => {
    // Simple case
    const sequences1 = [
      ['A', 'B', 'C'],
      ['A', 'C', 'B']
    ];
    const result1 = shortestCommonSupersequence(sequences1);
    console.log('Basic case:');
    console.log(visualizeAlignment(sequences1, result1));
    console.log('\n' + '='.repeat(50) + '\n');

    // Should contain all elements from both sequences
    expect(result1).toContain('A');
    expect(result1).toContain('B');
    expect(result1).toContain('C');
  });

  test('should handle adversarial inputs with gaps at beginning', async () => {
    const sequences = [
      ['X', 'A', 'B', 'C'],
      ['Y', 'A', 'B', 'C'],
      ['Z', 'A', 'B', 'C']
    ];
    const result = shortestCommonSupersequence(sequences);

    console.log('Gaps at beginning:');
    console.log(visualizeAlignment(sequences, result));
    console.log('\n' + '='.repeat(50) + '\n');

    // Should contain all unique elements
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).toContain('X');
    expect(result).toContain('Y');
    expect(result).toContain('Z');
  });

  test('should handle adversarial inputs with gaps in middle', async () => {
    const sequences = [
      ['A', 'X', 'B', 'C'],
      ['A', 'Y', 'B', 'C'],
      ['A', 'Z', 'B', 'C']
    ];
    const result = shortestCommonSupersequence(sequences);

    console.log('Gaps in middle:');
    console.log(visualizeAlignment(sequences, result));
    console.log('\n' + '='.repeat(50) + '\n');

    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).toContain('X');
    expect(result).toContain('Y');
    expect(result).toContain('Z');
  });

  test('should handle adversarial inputs with gaps at end', async () => {
    const sequences = [
      ['A', 'B', 'C', 'X'],
      ['A', 'B', 'C', 'Y'],
      ['A', 'B', 'C', 'Z']
    ];
    const result = shortestCommonSupersequence(sequences);

    console.log('Gaps at end:');
    console.log(visualizeAlignment(sequences, result));
    console.log('\n' + '='.repeat(50) + '\n');

    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
    expect(result).toContain('X');
    expect(result).toContain('Y');
    expect(result).toContain('Z');
  });

  test('should handle sequences with different numbers of loops', async () => {
    const sequences = [
      ['A', 'B', 'A', 'B', 'C'],           // 2 loops of AB
      ['A', 'B', 'A', 'B', 'A', 'B', 'C'], // 3 loops of AB
      ['A', 'B', 'C'],                     // 1 loop of AB
      ['C', 'A', 'B']                      // Different order
    ];
    const result = shortestCommonSupersequence(sequences);

    console.log('Different numbers of loops:');
    console.log(visualizeAlignment(sequences, result));
    console.log('\n' + '='.repeat(50) + '\n');

    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('C');
  });

  test('should handle complex adversarial case', async () => {
    const sequences = [
      ['X', 'A', 'B', 'Y', 'C', 'A', 'Z'],
      ['A', 'X', 'B', 'C', 'Y', 'A'],
      ['B', 'A', 'X', 'C', 'Z', 'Y'],
      ['A', 'B', 'C']
    ];
    const result = shortestCommonSupersequence(sequences);

    console.log('Complex adversarial case:');
    console.log(visualizeAlignment(sequences, result));
    console.log('\n' + '='.repeat(50) + '\n');

    // Check that all unique elements are present
    const uniqueElements = new Set(['X', 'A', 'B', 'Y', 'C', 'Z']);
    uniqueElements.forEach(element => {
      expect(result).toContain(element);
    });
  });

  test('should handle numeric sequences', async () => {
    const sequences = [
      [1, 2, 3, 4],
      [2, 1, 3, 4],
      [1, 3, 2, 4]
    ];
    const result = shortestCommonSupersequence(sequences);

    console.log('Numeric sequences:');
    console.log(visualizeAlignment(sequences, result));
    console.log('\n' + '='.repeat(50) + '\n');

    expect(result).toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
    expect(result).toContain(4);
  });

  test('should handle overlapping patterns', async () => {
    const sequences = [
      ['A', 'B', 'C', 'D', 'E'],
      ['B', 'C', 'D', 'E', 'F'],
      ['C', 'D', 'E', 'F', 'G'],
      ['A', 'C', 'E', 'G']
    ];
    const result = shortestCommonSupersequence(sequences);

    console.log('Overlapping patterns:');
    console.log(visualizeAlignment(sequences, result));
    console.log('\n' + '='.repeat(50) + '\n');

    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(element => {
      expect(result).toContain(element);
    });
  });

  test('should handle edge cases', async () => {
    // Empty sequences
    expect(shortestCommonSupersequence([])).toEqual([]);
    expect(shortestCommonSupersequence([[]])).toEqual([]);
    expect(shortestCommonSupersequence([[], []])).toEqual([]);

    // Single sequence
    expect(shortestCommonSupersequence([['A', 'B']])).toEqual(['A', 'B']);

    // Identical sequences
    const identical = [['A', 'B'], ['A', 'B'], ['A', 'B']];
    const identicalResult = shortestCommonSupersequence(identical);
    console.log('Identical sequences:');
    console.log(visualizeAlignment(identical, identicalResult));
    console.log('\n' + '='.repeat(50) + '\n');

    expect(identicalResult).toEqual(['A', 'B']);
  });
});