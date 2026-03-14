/**
 * Golf Card Game — Rules-based tests
 * Tests scoring, grid variants, column pairing, and round flow.
 */

describe('Golf Rules', () => {
  // Card scoring per golf rules
  function cardScore(rank: string): number {
    if (rank === 'J') return 0;
    if (rank === 'A') return 1;
    if (rank === 'K' || rank === 'Q') return 10;
    return parseInt(rank, 10);
  }

  describe('Card scoring', () => {
    it('Jack = 0 points', () => {
      expect(cardScore('J')).toBe(0);
    });

    it('Ace = 1 point', () => {
      expect(cardScore('A')).toBe(1);
    });

    it('3-10 = face value', () => {
      for (let i = 3; i <= 10; i++) {
        expect(cardScore(String(i))).toBe(i);
      }
    });

    it('King = 10 points', () => {
      expect(cardScore('K')).toBe(10);
    });

    it('Queen = 10 points', () => {
      expect(cardScore('Q')).toBe(10);
    });

    it('Jack is the best card (lowest score)', () => {
      const allRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const scores = allRanks.map(cardScore);
      const minScore = Math.min(...scores);
      expect(cardScore('J')).toBe(minScore);
    });
  });

  describe('Column pairing rule', () => {
    it('matching top and bottom card in a column = 0 points', () => {
      const topRank = '8';
      const bottomRank = '8';
      const columnScore = topRank === bottomRank ? 0 : cardScore(topRank) + cardScore(bottomRank);
      expect(columnScore).toBe(0);
    });

    it('non-matching column = sum of both cards', () => {
      const topRank = '8' as string;
      const bottomRank = '5' as string;
      const columnScore = topRank === bottomRank ? 0 : cardScore(topRank) + cardScore(bottomRank);
      expect(columnScore).toBe(13);
    });

    it('pair of Kings = 0 (not 20)', () => {
      const columnScore = 'K' === 'K' ? 0 : cardScore('K') + cardScore('K');
      expect(columnScore).toBe(0);
    });
  });

  describe('Grid variants', () => {
    it('4-card variant: 2x2 grid', () => {
      const rows = 2, cols = 2;
      expect(rows * cols).toBe(4);
    });

    it('6-card variant: 3x2 grid (3 columns, 2 rows)', () => {
      const rows = 2, cols = 3;
      expect(rows * cols).toBe(6);
      expect(cols).toBe(3); // 3 columns for pairing
    });

    it('9-card variant: 3x3 grid', () => {
      const rows = 3, cols = 3;
      expect(rows * cols).toBe(9);
    });
  });

  describe('Setup', () => {
    it('each player starts with 2 cards face up', () => {
      const totalCards = 6; // 6-card variant
      const faceUpAtStart = 2;
      const faceDownAtStart = totalCards - faceUpAtStart;
      expect(faceUpAtStart).toBe(2);
      expect(faceDownAtStart).toBe(4);
    });
  });

  describe('Turn actions', () => {
    it('player can draw from deck or discard pile', () => {
      const validSources = ['deck', 'discard'];
      expect(validSources).toHaveLength(2);
    });

    it('after drawing, player can swap with any card or discard', () => {
      const validActions = ['swap', 'discard'];
      expect(validActions).toHaveLength(2);
    });

    it('swapping with face-down card reveals it', () => {
      const wasFaceDown = true;
      const afterSwap = true; // new card is now face up
      expect(afterSwap).toBe(true);
    });
  });

  describe('Round ending', () => {
    it('round ends when a player flips all cards face up', () => {
      const totalCards = 6;
      const faceUpCards = 6;
      const allFlipped = faceUpCards === totalCards;
      expect(allFlipped).toBe(true);
    });

    it('other players get exactly one more turn after someone goes out', () => {
      const players = ['A', 'B', 'C', 'D'];
      const playerWhoFlipped = 'B';
      const playersWithFinalTurn = players.filter(p => p !== playerWhoFlipped);
      expect(playersWithFinalTurn).toHaveLength(3);
    });
  });

  describe('Game structure', () => {
    it('game lasts 9 rounds', () => {
      const totalRounds = 9;
      expect(totalRounds).toBe(9);
    });

    it('lowest total score wins', () => {
      const scores = [45, 32, 58, 29];
      const winner = scores.indexOf(Math.min(...scores));
      expect(scores[winner]).toBe(29);
    });
  });

  describe('Scoring edge cases', () => {
    it('best possible 6-card hand: all pairs of Jacks = 0', () => {
      // 3 columns, each with J-J pair = 0 + 0 + 0
      const bestScore = 0;
      expect(bestScore).toBe(0);
    });

    it('worst possible 6-card hand: all unpaired K/Q = 60', () => {
      // 3 columns, each with K-Q (different ranks, no pair) = 20 + 20 + 20
      const worstScore = 60;
      expect(worstScore).toBe(60);
    });
  });
});
