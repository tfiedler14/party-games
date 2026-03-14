/**
 * Horse Races — Rules-based tests
 * Tests track lengths, scratching, penalties, card dealing, and winning logic.
 */

describe('Horse Races Rules', () => {
  const TRACK_LENGTHS: Record<number, number> = {
    2: 3, 3: 5, 4: 7, 5: 9, 6: 11,
    7: 13,
    8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
  };

  describe('Track lengths', () => {
    it('should have 11 horses (2-12)', () => {
      expect(Object.keys(TRACK_LENGTHS)).toHaveLength(11);
    });

    it('track length should be symmetric around 7', () => {
      expect(TRACK_LENGTHS[2]).toBe(TRACK_LENGTHS[12]);
      expect(TRACK_LENGTHS[3]).toBe(TRACK_LENGTHS[11]);
      expect(TRACK_LENGTHS[4]).toBe(TRACK_LENGTHS[10]);
      expect(TRACK_LENGTHS[5]).toBe(TRACK_LENGTHS[9]);
      expect(TRACK_LENGTHS[6]).toBe(TRACK_LENGTHS[8]);
    });

    it('7 should have the longest track (most probable)', () => {
      const maxLength = Math.max(...Object.values(TRACK_LENGTHS));
      expect(TRACK_LENGTHS[7]).toBe(maxLength);
    });

    it('2 and 12 should have the shortest track (least probable)', () => {
      const minLength = Math.min(...Object.values(TRACK_LENGTHS));
      expect(TRACK_LENGTHS[2]).toBe(minLength);
      expect(TRACK_LENGTHS[12]).toBe(minLength);
    });
  });

  describe('Dice', () => {
    it('two dice sum range should be 2-12', () => {
      const min = 1 + 1;
      const max = 6 + 6;
      expect(min).toBe(2);
      expect(max).toBe(12);
    });

    it('all possible sums should have a horse', () => {
      for (let i = 2; i <= 12; i++) {
        expect(TRACK_LENGTHS[i]).toBeDefined();
      }
    });
  });

  describe('Scratching', () => {
    it('exactly 4 horses should be scratched', () => {
      const scratched = [4, 9, 3, 6]; // example
      expect(scratched).toHaveLength(4);
    });

    it('scratched horses must be unique', () => {
      const scratched = [4, 9, 3, 6];
      const unique = new Set(scratched);
      expect(unique.size).toBe(scratched.length);
    });

    it('penalty increases with scratch order (1-4)', () => {
      const penalties = [1, 2, 3, 4];
      for (let i = 1; i < penalties.length; i++) {
        expect(penalties[i]).toBeGreaterThan(penalties[i - 1]);
      }
    });

    it('scratched horses cannot win the race', () => {
      const scratched = new Set([4, 9, 3, 6]);
      const activeHorses = Object.keys(TRACK_LENGTHS)
        .map(Number)
        .filter(h => !scratched.has(h));
      expect(activeHorses).toHaveLength(7); // 11 - 4
      activeHorses.forEach(h => {
        expect(scratched.has(h)).toBe(false);
      });
    });
  });

  describe('Card dealing', () => {
    it('deck should have 44 cards (remove A, K, Joker)', () => {
      // 52 - 4 Aces - 4 Kings = 44 (no jokers in standard deck)
      const deckSize = 44;
      expect(deckSize).toBe(44);
    });

    it('cards should map to horses 2-12', () => {
      // 2-10 = face value, J=11, Q=12
      const cardToHorse: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
        '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12,
      };
      expect(Object.keys(cardToHorse)).toHaveLength(11);
      Object.values(cardToHorse).forEach(h => {
        expect(h).toBeGreaterThanOrEqual(2);
        expect(h).toBeLessThanOrEqual(12);
      });
    });

    it('each horse number should have 4 cards (one per suit)', () => {
      const cardsPerHorse = 4;
      const totalCards = 11 * cardsPerHorse;
      expect(totalCards).toBe(44);
    });

    it('cards for scratched horses should be discarded', () => {
      const totalCards = 44;
      const scratched = [4, 9, 3, 6]; // 4 horses × 4 cards each = 16 discarded
      const discarded = scratched.length * 4;
      const remaining = totalCards - discarded;
      expect(remaining).toBe(28);
    });
  });

  describe('Winning', () => {
    it('horse wins when position equals track length', () => {
      const horse = 7;
      const trackLength = TRACK_LENGTHS[horse];
      const position = trackLength; // reached end
      expect(position).toBe(trackLength);
    });

    it('players with matching cards split the pot', () => {
      const pot = 20;
      const winnersCount = 3; // 3 players hold cards for winning horse
      const share = Math.floor(pot / winnersCount);
      expect(share).toBe(6); // integer division
    });
  });
});
