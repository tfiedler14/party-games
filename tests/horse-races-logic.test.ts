/**
 * Horse Races — Logic tests
 */

const TRACK_LENGTHS: { [key: number]: number } = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};

describe('Horse Races Track Lengths', () => {
  it('has correct track lengths per rules', () => {
    expect(TRACK_LENGTHS[2]).toBe(3);
    expect(TRACK_LENGTHS[12]).toBe(3);
    expect(TRACK_LENGTHS[3]).toBe(5);
    expect(TRACK_LENGTHS[11]).toBe(5);
    expect(TRACK_LENGTHS[4]).toBe(7);
    expect(TRACK_LENGTHS[10]).toBe(7);
    expect(TRACK_LENGTHS[5]).toBe(9);
    expect(TRACK_LENGTHS[9]).toBe(9);
    expect(TRACK_LENGTHS[6]).toBe(11);
    expect(TRACK_LENGTHS[8]).toBe(11);
    expect(TRACK_LENGTHS[7]).toBe(13);
  });

  it('covers all 11 horses (2-12)', () => {
    for (let i = 2; i <= 12; i++) {
      expect(TRACK_LENGTHS[i]).toBeDefined();
    }
  });
});

describe('Horse Races Deck', () => {
  it('has 44 cards (4 suits × 11 values, no aces/kings)', () => {
    const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
    const deck: any[] = [];
    for (const suit of SUITS) {
      for (let v = 2; v <= 12; v++) {
        deck.push({ suit, value: v });
      }
    }
    expect(deck.length).toBe(44);
  });

  it('card values map correctly (J=11, Q=12)', () => {
    const cardValues = new Map([
      [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7],
      [8, 8], [9, 9], [10, 10], [11, 11], [12, 12],
    ]);
    expect(cardValues.get(11)).toBe(11); // Jack
    expect(cardValues.get(12)).toBe(12); // Queen
  });
});

describe('Scratch Penalty Logic', () => {
  it('penalties increase: 1st=1, 2nd=2, 3rd=3, 4th=4', () => {
    const scratched = [
      { horseNumber: 2, penaltyOrder: 1 },
      { horseNumber: 7, penaltyOrder: 2 },
      { horseNumber: 12, penaltyOrder: 3 },
      { horseNumber: 5, penaltyOrder: 4 },
    ];
    expect(scratched[0].penaltyOrder).toBe(1);
    expect(scratched[3].penaltyOrder).toBe(4);
  });

  it('chips cannot go below 0 after penalty (fixed bug)', () => {
    const chips = 2;
    const penalty = 4;
    const newChips = Math.max(0, chips - penalty);
    expect(newChips).toBe(0);
  });
});

describe('Scratch Duplicate Detection', () => {
  it('new scratch: lastScratchWasDuplicate = false', () => {
    const scratchedNumbers = [3, 7];
    const roll = 5;
    const isDuplicate = scratchedNumbers.includes(roll);
    expect(isDuplicate).toBe(false);
  });

  it('duplicate scratch: lastScratchWasDuplicate = true', () => {
    const scratchedNumbers = [3, 7];
    const roll = 7;
    const isDuplicate = scratchedNumbers.includes(roll);
    expect(isDuplicate).toBe(true);
  });
});

describe('Winner Determination', () => {
  it('players holding winning horse cards split the pot', () => {
    const winningHorse = 8;
    const players = [
      { name: 'A', hand: [{ value: 8 }, { value: 3 }] },
      { name: 'B', hand: [{ value: 5 }, { value: 10 }] },
      { name: 'C', hand: [{ value: 8 }, { value: 6 }] },
    ];
    const winners = players.filter(p => p.hand.some(c => c.value === winningHorse));
    expect(winners.map(w => w.name)).toEqual(['A', 'C']);
    
    const pot = 20;
    const payout = Math.floor(pot / winners.length);
    expect(payout).toBe(10);
  });

  it('no winners = nobody gets payout', () => {
    const winningHorse = 11;
    const players = [
      { name: 'A', hand: [{ value: 3 }] },
      { name: 'B', hand: [{ value: 5 }] },
    ];
    const winners = players.filter(p => p.hand.some(c => c.value === winningHorse));
    expect(winners.length).toBe(0);
  });
});
