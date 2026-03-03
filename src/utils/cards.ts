// Card types and utilities for Irish Poker

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Color = 'red' | 'black';

export interface Card {
  suit: Suit;
  rank: number; // 1-13 (1=Ace, 11=Jack, 12=Queen, 13=King)
  id: string; // Unique identifier for React keys
}

// Display helpers
export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_COLORS: Record<Suit, Color> = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
};

export const RANK_DISPLAY: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

/**
 * Get the color of a card
 */
export function getCardColor(card: Card): Color {
  return SUIT_COLORS[card.suit];
}

/**
 * Get display string for a card (e.g., "K♠", "7♥")
 */
export function getCardDisplay(card: Card): string {
  return `${RANK_DISPLAY[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

/**
 * Create a fresh 52-card deck
 */
export function createDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`,
      });
    }
  }

  return deck;
}

/**
 * Shuffle a deck using Fisher-Yates algorithm
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal cards from the deck
 * Returns [dealtCards, remainingDeck]
 */
export function dealCards(deck: Card[], count: number): [Card[], Card[]] {
  const dealt = deck.slice(0, count);
  const remaining = deck.slice(count);
  return [dealt, remaining];
}

/**
 * Get the effective value of a card for comparison
 * Handles the ace rule: 1st ace in hand = 1 (low), 2nd ace = 14 (high)
 * 
 * @param card - The card to evaluate
 * @param aceCount - Number of aces already seen in this player's hand (0 or 1)
 * @returns The effective value (1-14)
 */
export function getCardValue(card: Card, aceCount: number): number {
  if (card.rank === 1) {
    // Ace: first one is low (1), second one is high (14)
    return aceCount === 0 ? 1 : 14;
  }
  return card.rank;
}

/**
 * Count aces in a set of revealed cards
 */
export function countAces(cards: (Card | null)[]): number {
  return cards.filter(c => c !== null && c.rank === 1).length;
}

// Game logic types
export type RedBlackGuess = 'red' | 'black';
export type HigherLowerGuess = 'higher' | 'lower';
export type InBetweenGuess = 'in-between' | 'outside';
export type SuitGuess = Suit;

export type RoundGuess = RedBlackGuess | HigherLowerGuess | InBetweenGuess | SuitGuess;

/**
 * Check if Red/Black guess is correct
 */
export function checkRedBlack(card: Card, guess: RedBlackGuess): boolean {
  return getCardColor(card) === guess;
}

/**
 * Check if Higher/Lower guess is correct
 * Ties count as WRONG
 * 
 * @param newCard - The newly revealed card
 * @param previousCard - The card to compare against
 * @param guess - 'higher' or 'lower'
 * @param aceCountBefore - Aces seen before the new card
 */
export function checkHigherLower(
  newCard: Card,
  previousCard: Card,
  guess: HigherLowerGuess,
  aceCountBefore: number
): boolean {
  const prevAceCount = previousCard.rank === 1 ? 1 : 0;
  const prevValue = getCardValue(previousCard, 0); // First card's ace is always low
  const newValue = getCardValue(newCard, aceCountBefore);

  if (newValue === prevValue) {
    return false; // Ties are wrong
  }

  if (guess === 'higher') {
    return newValue > prevValue;
  } else {
    return newValue < prevValue;
  }
}

/**
 * Check if In-Between/Outside guess is correct
 * Hitting the boundary exactly counts as WRONG
 * 
 * @param newCard - The newly revealed card
 * @param card1 - First boundary card
 * @param card2 - Second boundary card
 * @param guess - 'in-between' or 'outside'
 * @param aceCountBefore - Aces seen before the new card
 */
export function checkInBetween(
  newCard: Card,
  card1: Card,
  card2: Card,
  guess: InBetweenGuess,
  aceCountBefore: number
): boolean {
  // Count aces in the boundary cards
  const ace1 = card1.rank === 1 ? 1 : 0;
  const ace2 = card2.rank === 1 ? 1 : 0;
  
  const value1 = getCardValue(card1, 0); // First ace is low
  const value2 = getCardValue(card2, ace1); // Second ace (if exists) is high
  const newValue = getCardValue(newCard, aceCountBefore);

  const low = Math.min(value1, value2);
  const high = Math.max(value1, value2);

  // Hitting boundary exactly is wrong
  if (newValue === low || newValue === high) {
    return false;
  }

  const isInBetween = newValue > low && newValue < high;

  if (guess === 'in-between') {
    return isInBetween;
  } else {
    return !isInBetween;
  }
}

/**
 * Check if Suit guess is correct
 */
export function checkSuit(card: Card, guess: SuitGuess): boolean {
  return card.suit === guess;
}

// Drink amounts per round
export const DRINK_AMOUNTS = {
  wrong: [1, 2, 3, 4], // Rounds 1-4: drink if wrong
  right: [2, 4, 6, 8], // Rounds 1-4: give out if right
};

export type RoundType = 'red-black' | 'higher-lower' | 'in-between' | 'suit';

export const ROUND_NAMES: Record<RoundType, string> = {
  'red-black': 'Red or Black',
  'higher-lower': 'Higher or Lower',
  'in-between': 'In-Between or Outside',
  'suit': 'Guess the Suit',
};

export const ROUND_ORDER: RoundType[] = [
  'red-black',
  'higher-lower', 
  'in-between',
  'suit',
];
