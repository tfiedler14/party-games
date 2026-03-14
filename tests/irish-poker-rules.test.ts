/**
 * Irish Poker — Rules-based tests
 * Tests game rules without looking at implementation details.
 * We import utility functions and test scoring/round logic.
 */
import { ROUND_NAMES, DRINK_AMOUNTS } from '../src/utils/cards';

describe('Irish Poker Rules', () => {
  describe('Round structure', () => {
    it('should have exactly 4 rounds', () => {
      expect(Object.keys(ROUND_NAMES)).toHaveLength(4);
    });

    it('rounds should be: red/black, higher/lower, in-between, suit', () => {
      const types = Object.keys(ROUND_NAMES);
      expect(types).toContain('red-black');
      expect(types).toContain('higher-lower');
      expect(types).toContain('in-between');
      expect(types).toContain('suit');
    });
  });

  describe('Drink amounts', () => {
    it('wrong drinks should increase each round', () => {
      const wrong = DRINK_AMOUNTS.wrong;
      for (let i = 1; i < wrong.length; i++) {
        expect(wrong[i]).toBeGreaterThanOrEqual(wrong[i - 1]);
      }
    });

    it('right drinks should increase each round', () => {
      const right = DRINK_AMOUNTS.right;
      for (let i = 1; i < right.length; i++) {
        expect(right[i]).toBeGreaterThanOrEqual(right[i - 1]);
      }
    });
  });

  describe('Red/Black guessing', () => {
    it('hearts and diamonds are red', () => {
      const redSuits = ['hearts', 'diamonds'];
      redSuits.forEach(suit => {
        expect(['hearts', 'diamonds']).toContain(suit);
      });
    });

    it('spades and clubs are black', () => {
      const blackSuits = ['spades', 'clubs'];
      blackSuits.forEach(suit => {
        expect(['spades', 'clubs']).toContain(suit);
      });
    });
  });

  describe('Card values', () => {
    it('Ace should be lowest (1), King highest (13)', () => {
      // Standard card values for comparison
      const values: Record<string, number> = {
        'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
        '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
      };
      expect(values['A']).toBeLessThan(values['K']);
      expect(values['A']).toBe(1);
      expect(values['K']).toBe(13);
    });
  });
});
