/**
 * Shortest Common Supersequence (SCS) module
 * Uses dynamic programming to find the exact optimal solution
 */

export type Sequence<T> = T[];

/**
 * Computes the exact shortest common supersequence for multiple sequences
 * Uses dynamic programming with memoization for optimal results
 * @param sequences Array of sequences to find the SCS for
 * @returns The shortest common supersequence (exact)
 */
export function shortestCommonSupersequence<T>(
  sequences: Sequence<T>[]
): Sequence<T> {
  console.log('SCS Input');
  console.log(sequences);
  if (sequences.length === 0) {
    return [];
  }
  if (sequences.length === 1) {
    return [...sequences[0]];
  }

  // Filter out empty sequences
  const nonEmptySequences = sequences.filter((seq) => seq.length > 0);
  if (nonEmptySequences.length === 0) {
    return [];
  }
  if (nonEmptySequences.length === 1) {
    return [...nonEmptySequences[0]];
  }

  // Use dynamic programming to find exact SCS
  const ret = computeExactSCS(nonEmptySequences);
  console.log('SCS Result');
  console.log(ret);
  return ret;
}

/**
 * Computes the exact SCS using dynamic programming with memoization
 */
function computeExactSCS<T>(sequences: Sequence<T>[]): Sequence<T> {
  const memo = new Map<string, Sequence<T>>();

  function scsRecursive(positions: number[]): Sequence<T> {
    // Create cache key from current positions
    const key = positions.join(',');
    if (memo.has(key)) {
      return memo.get(key)!;
    }

    // Base case: if all sequences are fully consumed, return empty array
    if (positions.every((pos, i) => pos >= sequences[i].length)) {
      const result: T[] = [];
      memo.set(key, result);
      return result;
    }

    // Check if all active sequences have the same current element
    const activeSequences = positions
      .map((pos, i) => (pos < sequences[i].length ? i : -1))
      .filter((i) => i !== -1);

    if (activeSequences.length > 0) {
      const currentElements = activeSequences.map(
        (i) => sequences[i][positions[i]]
      );
      const firstElement = currentElements[0];
      const allSame = currentElements.every(
        (el) => JSON.stringify(el) === JSON.stringify(firstElement)
      );

      if (allSame) {
        // All active sequences have the same current element, include it once
        const newPositions = [...positions];
        activeSequences.forEach((i) => newPositions[i]++);
        const rest = scsRecursive(newPositions);
        const result = [firstElement, ...rest];
        memo.set(key, result);
        return result;
      }
    }

    // Try advancing each sequence individually and pick the best result
    let bestResult: Sequence<T> = [];
    let bestLength = Infinity;

    for (let i = 0; i < sequences.length; i++) {
      if (positions[i] < sequences[i].length) {
        const newPositions = [...positions];
        newPositions[i]++;

        const rest = scsRecursive(newPositions);
        const result = [sequences[i][positions[i]], ...rest];

        if (result.length < bestLength) {
          bestLength = result.length;
          bestResult = result;
        }
      }
    }

    memo.set(key, bestResult);
    return bestResult;
  }

  const initialPositions = new Array(sequences.length).fill(0);
  return scsRecursive(initialPositions);
}

/**
 * Visualizes the alignment of sequences with their supersequence
 */
export function visualizeAlignment<T>(
  sequences: Sequence<T>[],
  supersequence: Sequence<T>
): string {
  const lines: string[] = [];

  // Add header
  lines.push('Input sequences and their alignment with the supersequence:\n');

  // Convert elements to strings for display
  const seqStrings = sequences.map((seq) => seq.map((el) => String(el)));
  const superStr = supersequence.map((el) => String(el));

  // Calculate column widths
  const maxWidth = Math.max(
    ...superStr.map((s) => s.length),
    ...seqStrings.flat().map((s) => s.length),
    1
  );

  // Add supersequence
  lines.push('SCS: ' + superStr.map((s) => s.padEnd(maxWidth)).join(' '));
  lines.push('     ' + superStr.map(() => '─'.repeat(maxWidth)).join(' '));

  // Add each input sequence aligned with the supersequence
  sequences.forEach((seq, seqIndex) => {
    const aligned = alignSequenceToSupersequence(seq, supersequence);
    const paddedAligned = aligned.map((s) =>
      s ? s.padEnd(maxWidth) : ' '.repeat(maxWidth)
    );
    lines.push(`S${seqIndex + 1}:  ` + paddedAligned.join(' '));
  });

  return lines.join('\n');
}

/**
 * Aligns a sequence to the supersequence for visualization
 */
function alignSequenceToSupersequence<T>(
  sequence: Sequence<T>,
  supersequence: Sequence<T>
): (string | null)[] {
  const aligned: (string | null)[] = new Array(supersequence.length).fill(null);
  let seqIndex = 0;

  for (
    let superIndex = 0;
    superIndex < supersequence.length && seqIndex < sequence.length;
    superIndex++
  ) {
    if (
      JSON.stringify(sequence[seqIndex]) ===
      JSON.stringify(supersequence[superIndex])
    ) {
      aligned[superIndex] = String(sequence[seqIndex]);
      seqIndex++;
    }
  }

  return aligned;
}
