/**
 * Ship Captain Crew — Logic tests
 * Tests chase mode turn order, finishing, auto-lock, and cargo calculation
 */

describe('SCC Chase Mode Turn Order', () => {
  // Simulate the chase turn order logic from the service
  function getChaseTurns(turnOrder: string[], scorerIdx: number): string[] {
    const scorerId = turnOrder[scorerIdx];
    const reordered: string[] = [];
    for (let i = 1; i < turnOrder.length; i++) {
      reordered.push(turnOrder[(scorerIdx + i) % turnOrder.length]);
    }
    return reordered;
  }

  it('when first player scores, chase goes in order [B, C]', () => {
    expect(getChaseTurns(['A', 'B', 'C'], 0)).toEqual(['B', 'C']);
  });

  it('when middle player scores, chase continues from next [C, A]', () => {
    expect(getChaseTurns(['A', 'B', 'C'], 1)).toEqual(['C', 'A']);
  });

  it('when last player scores, chase wraps to beginning [A, B]', () => {
    expect(getChaseTurns(['A', 'B', 'C'], 2)).toEqual(['A', 'B']);
  });

  it('2 players: scorer first, other gets one turn', () => {
    expect(getChaseTurns(['A', 'B'], 0)).toEqual(['B']);
    expect(getChaseTurns(['A', 'B'], 1)).toEqual(['A']);
  });

  it('5 players: middle scorer', () => {
    const result = getChaseTurns(['A', 'B', 'C', 'D', 'E'], 2);
    expect(result).toEqual(['D', 'E', 'A', 'B']);
  });
});

describe('SCC Auto-Lock Logic', () => {
  function autoLockSCC(dice: { value: number; locked: boolean; lockedAs: string | null }[]) {
    let hasShip = false, hasCaptain = false, hasCrew = false;
    
    if (!hasShip) {
      const idx = dice.findIndex(d => !d.locked && d.value === 6);
      if (idx !== -1) { dice[idx].locked = true; dice[idx].lockedAs = 'ship'; hasShip = true; }
    }
    if (hasShip && !hasCaptain) {
      const idx = dice.findIndex(d => !d.locked && d.value === 5);
      if (idx !== -1) { dice[idx].locked = true; dice[idx].lockedAs = 'captain'; hasCaptain = true; }
    }
    if (hasShip && hasCaptain && !hasCrew) {
      const idx = dice.findIndex(d => !d.locked && d.value === 4);
      if (idx !== -1) { dice[idx].locked = true; dice[idx].lockedAs = 'crew'; hasCrew = true; }
    }
    let cargo = null;
    if (hasShip && hasCaptain && hasCrew) {
      const cargoDice = dice.filter(d => d.lockedAs === null || d.lockedAs === 'cargo');
      cargo = cargoDice.reduce((sum, d) => sum + d.value, 0);
    }
    return { hasShip, hasCaptain, hasCrew, cargo };
  }

  it('locks 6-5-4 in order from a single roll', () => {
    const dice = [
      { value: 6, locked: false, lockedAs: null },
      { value: 5, locked: false, lockedAs: null },
      { value: 4, locked: false, lockedAs: null },
      { value: 3, locked: false, lockedAs: null },
      { value: 2, locked: false, lockedAs: null },
    ];
    const result = autoLockSCC(dice);
    expect(result.hasShip).toBe(true);
    expect(result.hasCaptain).toBe(true);
    expect(result.hasCrew).toBe(true);
    expect(result.cargo).toBe(5); // 3 + 2
  });

  it('cannot lock captain without ship', () => {
    const dice = [
      { value: 5, locked: false, lockedAs: null },
      { value: 4, locked: false, lockedAs: null },
      { value: 3, locked: false, lockedAs: null },
      { value: 2, locked: false, lockedAs: null },
      { value: 1, locked: false, lockedAs: null },
    ];
    const result = autoLockSCC(dice);
    expect(result.hasShip).toBe(false);
    expect(result.hasCaptain).toBe(false);
    expect(result.hasCrew).toBe(false);
    expect(result.cargo).toBeNull();
  });

  it('max cargo is 12 (two sixes)', () => {
    const dice = [
      { value: 6, locked: false, lockedAs: null },
      { value: 5, locked: false, lockedAs: null },
      { value: 4, locked: false, lockedAs: null },
      { value: 6, locked: false, lockedAs: null },
      { value: 6, locked: false, lockedAs: null },
    ];
    const result = autoLockSCC(dice);
    expect(result.cargo).toBe(12);
  });
});

describe('SCC Finish Game Logic', () => {
  function finishGame(players: { roundScore: number | null; playerName: string }[]) {
    const scorers = players.filter(p => p.roundScore !== null);
    const busters = players.filter(p => p.roundScore === null);
    
    let loser;
    if (busters.length > 0) {
      loser = busters[0];
    } else if (scorers.length > 0) {
      loser = scorers.reduce((worst, p) =>
        (p.roundScore! < worst.roundScore!) ? p : worst
      );
    } else {
      loser = players[0];
    }
    return loser;
  }

  it('buster loses over scorer', () => {
    const loser = finishGame([
      { roundScore: 5, playerName: 'A' },
      { roundScore: null, playerName: 'B' },
    ]);
    expect(loser.playerName).toBe('B');
  });

  it('lowest scorer loses when all score', () => {
    const loser = finishGame([
      { roundScore: 8, playerName: 'A' },
      { roundScore: 3, playerName: 'B' },
      { roundScore: 11, playerName: 'C' },
    ]);
    expect(loser.playerName).toBe('B');
  });

  it('fallback when no players have scores', () => {
    const loser = finishGame([
      { roundScore: null, playerName: 'A' },
      { roundScore: null, playerName: 'B' },
    ]);
    expect(loser.playerName).toBe('A');
  });
});
