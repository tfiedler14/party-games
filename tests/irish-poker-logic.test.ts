/**
 * Irish Poker — Logic tests using actual card utility functions
 */
import {
  checkRedBlack,
  checkHigherLower,
  checkInBetween,
  checkSuit,
  getCardValue,
  countAces,
  DRINK_AMOUNTS,
  Card,
} from '../src/utils/cards';

function makeCard(rank: number, suit: string = 'hearts'): Card {
  return { rank, suit: suit as any, id: `${suit}-${rank}` };
}

describe('Red/Black', () => {
  it('hearts is red', () => {
    expect(checkRedBlack(makeCard(5, 'hearts'), 'red')).toBe(true);
  });
  it('spades is black', () => {
    expect(checkRedBlack(makeCard(5, 'spades'), 'black')).toBe(true);
  });
  it('wrong guess', () => {
    expect(checkRedBlack(makeCard(5, 'hearts'), 'black')).toBe(false);
  });
});

describe('Higher/Lower', () => {
  it('higher card with higher guess = correct', () => {
    expect(checkHigherLower(makeCard(10), makeCard(5), 'higher', 0)).toBe(true);
  });
  it('lower card with lower guess = correct', () => {
    expect(checkHigherLower(makeCard(3), makeCard(8), 'lower', 0)).toBe(true);
  });
  it('tie = wrong', () => {
    expect(checkHigherLower(makeCard(7), makeCard(7), 'higher', 0)).toBe(false);
    expect(checkHigherLower(makeCard(7), makeCard(7), 'lower', 0)).toBe(false);
  });
  it('ace handling: first ace is low (1)', () => {
    expect(checkHigherLower(makeCard(1), makeCard(3), 'lower', 0)).toBe(true);
  });
  it('ace handling: second ace is high (14)', () => {
    expect(checkHigherLower(makeCard(1), makeCard(13), 'higher', 1)).toBe(true);
  });
});

describe('In-Between', () => {
  it('card between two boundaries = in-between correct', () => {
    expect(checkInBetween(makeCard(5), makeCard(3), makeCard(8), 'in-between', 0)).toBe(true);
  });
  it('card outside boundaries = outside correct', () => {
    expect(checkInBetween(makeCard(10), makeCard(3), makeCard(8), 'outside', 0)).toBe(true);
  });
  it('hitting boundary exactly = wrong', () => {
    expect(checkInBetween(makeCard(3), makeCard(3), makeCard(8), 'in-between', 0)).toBe(false);
    expect(checkInBetween(makeCard(8), makeCard(3), makeCard(8), 'in-between', 0)).toBe(false);
  });
});

describe('Suit', () => {
  it('correct suit guess', () => {
    expect(checkSuit(makeCard(5, 'clubs'), 'clubs')).toBe(true);
  });
  it('wrong suit guess', () => {
    expect(checkSuit(makeCard(5, 'clubs'), 'hearts')).toBe(false);
  });
});

describe('Drink Amounts', () => {
  it('wrong amounts increase per round: 1, 2, 3, 4', () => {
    expect(DRINK_AMOUNTS.wrong).toEqual([1, 2, 3, 4]);
  });
  it('right amounts increase per round: 2, 4, 6, 8', () => {
    expect(DRINK_AMOUNTS.right).toEqual([2, 4, 6, 8]);
  });
});

describe('Ace counting', () => {
  it('counts aces in card array', () => {
    const cards = [makeCard(1), makeCard(5), makeCard(1), null];
    expect(countAces(cards)).toBe(2);
  });
  it('no aces', () => {
    expect(countAces([makeCard(5), makeCard(10)])).toBe(0);
  });
});

describe('getCardValue', () => {
  it('non-ace returns rank', () => {
    expect(getCardValue(makeCard(7), 0)).toBe(7);
    expect(getCardValue(makeCard(13), 0)).toBe(13);
  });
  it('first ace = 1 (low)', () => {
    expect(getCardValue(makeCard(1), 0)).toBe(1);
  });
  it('second ace = 14 (high)', () => {
    expect(getCardValue(makeCard(1), 1)).toBe(14);
  });
});
