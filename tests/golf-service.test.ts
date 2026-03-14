/**
 * Golf Service — Logic tests using actual calculateGridScore
 */
import { calculateGridScore } from '../src/services/golfService';
import { Card } from '../src/utils/cards';

function makeCard(rank: number, suit: string = 'hearts'): Card {
  return { rank, suit: suit as any, id: `${suit}-${rank}` };
}

function makeGolfCard(rank: number, suit: string = 'hearts', faceUp = true) {
  return { card: makeCard(rank, suit), faceUp };
}

describe('Golf calculateGridScore', () => {
  describe('6-card (2 rows, 3 cols)', () => {
    it('scores individual cards correctly', () => {
      // Grid: [A, 5, K] / [3, J, Q] — no pairs
      const grid = [
        makeGolfCard(1), makeGolfCard(5), makeGolfCard(13),  // row 0
        makeGolfCard(3), makeGolfCard(11), makeGolfCard(12), // row 1
      ];
      // Col0: A(1)+3 = 4, Col1: 5+J(0) = 5, Col2: K(10)+Q(10) = 20
      expect(calculateGridScore(grid, '6-card')).toBe(29);
    });

    it('column pair = 0 points', () => {
      // Grid: [8, 5, K] / [8, J, Q]
      const grid = [
        makeGolfCard(8), makeGolfCard(5), makeGolfCard(13),
        makeGolfCard(8, 'diamonds'), makeGolfCard(11), makeGolfCard(12),
      ];
      // Col0: pair 8s = 0, Col1: 5+0=5, Col2: 10+10=20
      expect(calculateGridScore(grid, '6-card')).toBe(25);
    });

    it('all pairs = 0', () => {
      const grid = [
        makeGolfCard(11), makeGolfCard(11, 'clubs'), makeGolfCard(11, 'diamonds'),
        makeGolfCard(11, 'spades'), makeGolfCard(11, 'hearts'), makeGolfCard(11, 'clubs'),
      ];
      // All columns match (J-J) = 0 + 0 + 0 = 0
      // Note: reusing same id but ranks match
      expect(calculateGridScore(grid, '6-card')).toBe(0);
    });

    it('King pair = 0', () => {
      const grid = [
        makeGolfCard(13), makeGolfCard(2), makeGolfCard(3),
        makeGolfCard(13, 'diamonds'), makeGolfCard(4), makeGolfCard(5),
      ];
      // Col0: K-K pair = 0, Col1: 2+4=6, Col2: 3+5=8
      expect(calculateGridScore(grid, '6-card')).toBe(14);
    });
  });

  describe('4-card (2 rows, 2 cols)', () => {
    it('scores correctly', () => {
      const grid = [
        makeGolfCard(1), makeGolfCard(10),
        makeGolfCard(5), makeGolfCard(10, 'diamonds'),
      ];
      // Col0: A(1)+5=6, Col1: 10+10 pair = 0
      expect(calculateGridScore(grid, '4-card')).toBe(6);
    });
  });

  describe('9-card (3 rows, 3 cols)', () => {
    it('3-of-a-kind in column = 0', () => {
      const grid = [
        makeGolfCard(7), makeGolfCard(2), makeGolfCard(3),
        makeGolfCard(7, 'diamonds'), makeGolfCard(4), makeGolfCard(5),
        makeGolfCard(7, 'clubs'), makeGolfCard(6), makeGolfCard(8),
      ];
      // Col0: 7-7-7 = 0, Col1: 2+4+6=12, Col2: 3+5+8=16
      expect(calculateGridScore(grid, '9-card')).toBe(28);
    });

    it('2 matching in 3-card column does NOT cancel (need 3-of-a-kind)', () => {
      const grid = [
        makeGolfCard(7), makeGolfCard(2), makeGolfCard(3),
        makeGolfCard(9), makeGolfCard(4), makeGolfCard(5),
        makeGolfCard(7, 'clubs'), makeGolfCard(6), makeGolfCard(8),
      ];
      // Col0: no 3-of-a-kind, sum = 7+9+7 = 23
      expect(calculateGridScore(grid, '9-card')).toBe(23 + 12 + 16);
    });
  });
});
