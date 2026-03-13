// Player in a lobby
export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

// Lobby state
export interface Lobby {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  gameType: GameType | null;
  gameConfig: GameConfig | null;
  status: 'waiting' | 'selecting' | 'playing' | 'finished';
  createdAt: number;
}

// Available games
export type GameType = 'irish-poker' | 'fishbowl' | 'golf' | 'ship-captain-crew';

// Game configuration types
export interface IrishPokerConfig {
  includeRideTheBus: boolean;
  // Future options: drink multiplier, custom rules, etc.
}

// ============================================
// IRISH POKER GAME STATE
// ============================================

import { Card, RoundType, RoundGuess, Suit } from '../utils/cards';

// A player's hand in Irish Poker
export interface IrishPokerHand {
visibleCards: (Card | null)[]; // 4 cards, null = face down, Card = revealed
  guesses: (RoundGuess | null)[]; // What they guessed for each round
  results: (boolean | null)[]; // true = correct, false = wrong, null = not played
}

// Drink tracking for a player
export interface DrinkScore {
  assigned: number; // Drinks assigned to this player
  consumed: number; // Drinks they've actually taken
}

// A player's full state in the game
export interface IrishPokerPlayer {
  playerId: string;
  playerName: string;
  isHost: boolean;
  hand: IrishPokerHand;
  drinks: DrinkScore;
  // For Ride the Bus - actual cards in possession (changes as cards are given/received)
  rtbHand: Card[]; // Current cards during RTB (starts as copy of original hand)
}

// Ride the Bus state
export interface RideTheBusState {
  phase: 'flip' | 'overtime' | 'riding' | 'complete';
  // Flip phase
  giveRow: (Card | null)[]; // 4 cards for "give a drink"
  takeRow: (Card | null)[]; // 4 cards for "take a drink"
  currentFlipIndex: number; // 0-7 (alternates give/take)
  // Current flip state (synced across all players)
  currentFlipCard: Card | null; // The card that was just flipped
  waitingForAssignment: boolean; // True if waiting for someone to assign (GIVE row)
  waitingForDrinkAck: boolean; // True if waiting for drink acknowledgment (TAKE row)
  matchingPlayerIds: string[]; // Players who have the matching card
  // Riding phase
  riderId: string | null; // Player who has to ride
  riderCards: (Card | null)[]; // Up to 4 cards for the rider
  riderRound: number; // 0-3 (which round they're on)
  riderCardRevealed: boolean; // Whether current rider card has been revealed after guess
  riderLastGuess: { correct: boolean; escaped: boolean } | null; // Result of last guess
}

// Main game state
export interface IrishPokerGameState {
  // Game info
  lobbyCode: string;
  config: IrishPokerConfig;
  
  // Deck
  deck: Card[]; // Remaining cards in deck
  
  // Players
  players: IrishPokerPlayer[];
  turnOrder: string[]; // Player IDs in turn order
  
  // Current round state
  currentRound: number; // 0-3 (which of the 4 rounds)
  currentPlayerIndex: number; // Index into turnOrder
  roundType: RoundType;
  
  // Game phase
  phase: 'main' | 'ride-the-bus' | 'complete';
  
  // Ride the Bus (if enabled)
  rideTheBus: RideTheBusState | null;
  
  // Timestamps
  startedAt: number;
  updatedAt: number;
}

export interface FishbowlConfig {
  slipsPerPlayer: number; // How many slips each player writes (3-5)
  turnTimeSeconds: number; // Time per turn (usually 60)
}

// ============================================
// FISHBOWL GAME STATE
// ============================================

// A slip of paper with a clue
export interface Slip {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
}

// Team in Fishbowl
export interface FishbowlTeam {
  id: 'team1' | 'team2';
  name: string;
  playerIds: string[];
  score: number; // Total correct guesses across all rounds
}

// Fishbowl round types
export type FishbowlRoundType = 'describe' | 'charades' | 'one-word' | 'silhouette';

export const FISHBOWL_ROUNDS: { type: FishbowlRoundType; name: string; description: string }[] = [
  { type: 'describe', name: 'Describe It', description: 'Describe the clue without saying the words' },
  { type: 'charades', name: 'Charades', description: 'Act it out - no talking!' },
  { type: 'one-word', name: 'One Word', description: 'Say only ONE word as your clue' },
  { type: 'silhouette', name: 'Silhouette', description: 'Charades behind a sheet - only your shadow!' },
];

// Player in Fishbowl
export interface FishbowlPlayer {
  playerId: string;
  playerName: string;
  isHost: boolean;
  teamId: 'team1' | 'team2' | null;
  slipsSubmitted: number; // How many slips they've written
  isReady: boolean; // Ready to start
}

// Current turn state
export interface FishbowlTurn {
  clueGiverId: string;
  clueGiverName: string;
  teamId: 'team1' | 'team2';
  currentSlip: Slip | null; // The slip currently being guessed
  slipsGuessedThisTurn: number; // Count for this turn
  startedAt: number; // When the turn started
  isPaused: boolean; // Paused for UI (e.g., between slips)
}

// Game phases
export type FishbowlPhase = 
  | 'setup' // Players writing slips
  | 'teams' // Assigning teams
  | 'playing' // Active gameplay
  | 'round-end' // Between rounds
  | 'game-over'; // Final scores

// Main Fishbowl game state
export interface FishbowlGameState {
  lobbyCode: string;
  config: FishbowlConfig;
  
  // Players
  players: FishbowlPlayer[];
  
  // Teams
  teams: {
    team1: FishbowlTeam;
    team2: FishbowlTeam;
  };
  
  // The bowl
  allSlips: Slip[]; // All slips ever written (for reference)
  bowl: Slip[]; // Current slips in the bowl
  
  // Round state
  currentRound: number; // 0-3
  roundType: FishbowlRoundType;
  
  // Turn state
  currentTurn: FishbowlTurn | null;
  currentTeamId: 'team1' | 'team2'; // Which team is up
  turnOrderIndex: number; // Index within the team's player list
  
  // Game phase
  phase: FishbowlPhase;
  
  // Timestamps
  startedAt: number;
  updatedAt: number;
}

export interface GolfConfig {
  numberOfHoles: number;
  // Future options: mulligan rules, scoring variants, etc.
}

export interface ShipCaptainCrewConfig {
  maxRounds: number; // max rounds before forced end (default 10)
}

// ============================================
// SHIP CAPTAIN CREW GAME STATE
// ============================================

export interface SCCDie {
  value: number; // 1-6
  locked: boolean; // locked by player between rolls
  lockedAs: 'ship' | 'captain' | 'crew' | 'cargo' | null; // what it's locked as
}

export interface SCCPlayerState {
  playerId: string;
  playerName: string;
  isHost: boolean;
  // Current turn state (only meaningful for active player)
  dice: SCCDie[];
  rollsLeft: number; // 0-3
  hasShip: boolean;
  hasCaptain: boolean;
  hasCrew: boolean;
  cargo: number | null; // sum of remaining 2 dice if ship+captain+crew found, null otherwise
  // Round results
  roundScore: number | null; // cargo score for this round, null if didn't get 6-5-4
  // Overall
  totalScore: number; // cumulative across rounds
  isBustThisRound: boolean; // true if they didn't get 6-5-4
}

export type SCCPhase = 
  | 'rolling' // active player is rolling
  | 'round-end' // round finished, showing results
  | 'game-over'; // game complete

export interface ShipCaptainCrewGameState {
  lobbyCode: string;
  config: ShipCaptainCrewConfig;
  
  players: SCCPlayerState[];
  turnOrder: string[];
  
  currentPlayerIndex: number;
  currentRound: number;
  
  // Chase mechanic: once someone scores, others get one more turn
  highScore: number | null; // current high score to beat
  highScorerId: string | null; // who set it
  chaseMode: boolean; // true = someone scored, rest get one turn
  chaseTurnsRemaining: string[]; // player IDs who still get their chase turn
  
  phase: SCCPhase;
  
  // Drink result
  loserId: string | null; // player who has to drink
  loserName: string | null;
  
  startedAt: number;
  updatedAt: number;
}

export type GameConfig = 
  | { type: 'irish-poker'; settings: IrishPokerConfig }
  | { type: 'fishbowl'; settings: FishbowlConfig }
  | { type: 'golf'; settings: GolfConfig }
  | { type: 'ship-captain-crew'; settings: ShipCaptainCrewConfig };

// Game metadata for display
export interface GameInfo {
  id: GameType;
  name: string;
  emoji: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
}

// Navigation param types
export type RootStackParamList = {
  Home: undefined;
  HostLobby: undefined;
  JoinLobby: undefined;
  Lobby: { 
    lobbyCode: string; 
    playerName: string; 
    isHost: boolean;
    playerId: string;
  };
};
