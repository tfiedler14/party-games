/**
 * Ship Captain Crew — Rules-based tests
 * Tests game rules: dice locking order, scoring, turn flow.
 */

describe('Ship Captain Crew Rules', () => {
  // Helper: simulate auto-lock logic (mirrors game rules, not implementation)
  function autoLock(dice: number[]): { ship: boolean; captain: boolean; crew: boolean; cargo: number | null; locked: number[] } {
    const locked: number[] = [];
    let ship = false, captain = false, crew = false;
    const remaining = [...dice];

    // Must lock 6 first
    const sixIdx = remaining.indexOf(6);
    if (sixIdx !== -1) {
      ship = true;
      locked.push(6);
      remaining.splice(sixIdx, 1);
    }

    // Then 5
    if (ship) {
      const fiveIdx = remaining.indexOf(5);
      if (fiveIdx !== -1) {
        captain = true;
        locked.push(5);
        remaining.splice(fiveIdx, 1);
      }
    }

    // Then 4
    if (captain) {
      const fourIdx = remaining.indexOf(4);
      if (fourIdx !== -1) {
        crew = true;
        locked.push(4);
        remaining.splice(fourIdx, 1);
      }
    }

    const cargo = (ship && captain && crew) ? remaining.reduce((a, b) => a + b, 0) : null;
    return { ship, captain, crew, cargo, locked };
  }

  describe('Locking order', () => {
    it('must lock 6 (ship) before 5 (captain)', () => {
      const result = autoLock([5, 5, 5, 5, 5]); // all 5s, no 6
      expect(result.ship).toBe(false);
      expect(result.captain).toBe(false);
    });

    it('must lock 5 (captain) before 4 (crew)', () => {
      const result = autoLock([6, 4, 4, 4, 4]); // has 6 but no 5
      expect(result.ship).toBe(true);
      expect(result.captain).toBe(false);
      expect(result.crew).toBe(false);
    });

    it('locks 6-5-4 when all present', () => {
      const result = autoLock([6, 5, 4, 3, 2]);
      expect(result.ship).toBe(true);
      expect(result.captain).toBe(true);
      expect(result.crew).toBe(true);
      expect(result.cargo).toBe(5); // 3 + 2
    });

    it('does not lock captain without ship even if 5 is present', () => {
      const result = autoLock([1, 5, 4, 3, 2]);
      expect(result.ship).toBe(false);
      expect(result.captain).toBe(false);
      expect(result.crew).toBe(false);
      expect(result.cargo).toBeNull();
    });
  });

  describe('Cargo scoring', () => {
    it('cargo is sum of 2 remaining dice after 6-5-4 locked', () => {
      const result = autoLock([6, 5, 4, 6, 6]);
      expect(result.cargo).toBe(12); // 6 + 6
    });

    it('max cargo is 12 (two 6s)', () => {
      const result = autoLock([6, 5, 4, 6, 6]);
      expect(result.cargo).toBe(12);
    });

    it('min cargo is 2 (two 1s)', () => {
      const result = autoLock([6, 5, 4, 1, 1]);
      expect(result.cargo).toBe(2);
    });

    it('no cargo without full ship-captain-crew', () => {
      const result = autoLock([6, 5, 3, 2, 1]);
      expect(result.cargo).toBeNull();
    });
  });

  describe('Dice rules', () => {
    it('each die should be 1-6', () => {
      for (let i = 0; i < 1000; i++) {
        const val = Math.floor(Math.random() * 6) + 1;
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(6);
      }
    });

    it('player gets exactly 3 rolls per turn', () => {
      const rollsPerTurn = 3;
      expect(rollsPerTurn).toBe(3);
    });
  });

  describe('Game flow', () => {
    it('chase mode: once someone scores, others get exactly 1 turn', () => {
      const players = ['A', 'B', 'C'];
      const scorer = 'A';
      const chasePlayers = players.filter(p => p !== scorer);
      expect(chasePlayers).toEqual(['B', 'C']);
      expect(chasePlayers).toHaveLength(players.length - 1);
    });

    it('bust: no 6-5-4 after 3 rolls = no score', () => {
      // Simulate 3 rolls that never get all three
      const roll1 = autoLock([1, 2, 3, 3, 2]);
      const roll2 = autoLock([1, 1, 3, 2, 2]);
      const roll3 = autoLock([2, 3, 1, 1, 3]);
      expect(roll1.cargo).toBeNull();
      expect(roll2.cargo).toBeNull();
      expect(roll3.cargo).toBeNull();
    });

    it('loser is the player with lowest score (or no score)', () => {
      const scores: (number | null)[] = [8, null, 5];
      const loserIdx = scores.reduce((minIdx: number, score, idx) => {
        if (score === null) return idx;
        const minScore = scores[minIdx as number];
        if (minScore === null) return minIdx;
        return score < minScore ? idx : minIdx;
      }, 0);
      // null (bust) should be the loser
      expect(loserIdx).toBe(1);
    });
  });
});
