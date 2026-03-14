import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { GolfGameState, GolfCard, GolfVariant } from '../types';
import { RANK_DISPLAY, SUIT_SYMBOLS, SUIT_COLORS } from '../utils/cards';
import { calculateGridScore } from '../services/golfService';

interface GolfProps {
  gameState: GolfGameState;
  currentPlayerId: string;
  isHost: boolean;
  onFlipInitial: (cardIndex: number) => void;
  onDrawCard: (source: 'deck' | 'discard') => void;
  onSwapCard: (cardIndex: number) => void;
  onDiscardDrawn: (flipIndex?: number) => void;
  onStartNextRound: () => void;
  onReplay: () => void;
  onExit: () => void;
}

const COLORS = {
  bg: '#1a1a2e',
  card: '#16213e',
  accent: '#e94560',
  muted: '#8b8b9e',
  green: '#4ecca3',
  white: '#eee',
  cardBack: '#2a3a5e',
  gold: '#ffd700',
};

function getColumns(variant: GolfVariant): number {
  return variant === '4-card' ? 2 : 3;
}

function getRows(variant: GolfVariant): number {
  return variant === '4-card' ? 2 : variant === '6-card' ? 2 : 3;
}

function CardView({ golfCard, onPress, highlight, small }: {
  golfCard: GolfCard | null;
  onPress?: () => void;
  highlight?: boolean;
  small?: boolean;
}) {
  if (!golfCard) return <View style={[s.cardSlot, small && s.cardSmall]} />;
  
  const size = small ? s.cardSmall : s.cardNormal;
  
  if (!golfCard.faceUp) {
    return (
      <Pressable onPress={onPress} style={[s.cardSlot, size, s.cardBackStyle, highlight && s.cardHighlight]}>
        <Text style={[s.cardBackText, small && { fontSize: 14 }]}>🂠</Text>
      </Pressable>
    );
  }

  const { card } = golfCard;
  const color = SUIT_COLORS[card.suit] === 'red' ? '#e94560' : '#eee';
  
  return (
    <Pressable onPress={onPress} style={[s.cardSlot, size, s.cardFace, highlight && s.cardHighlight]}>
      <Text style={[s.cardRank, { color }, small && { fontSize: 12 }]}>{RANK_DISPLAY[card.rank]}</Text>
      <Text style={[s.cardSuit, { color }, small && { fontSize: 10 }]}>{SUIT_SYMBOLS[card.suit]}</Text>
    </Pressable>
  );
}

function PlayerGrid({ player, variant, isActive, isCurrent, onCardPress, drawnCard, phase }: {
  player: GolfGameState['players'][0];
  variant: GolfVariant;
  isActive: boolean;
  isCurrent: boolean;
  onCardPress?: (index: number) => void;
  drawnCard: boolean;
  phase: string;
}) {
  const cols = getColumns(variant);
  const rows = getRows(variant);
  const small = !isCurrent;
  const score = useMemo(() => {
    const allUp = player.grid.every(c => c && c.faceUp);
    return allUp ? calculateGridScore(player.grid, variant) : null;
  }, [player.grid, variant]);

  return (
    <View style={[s.playerGrid, isActive && s.activeGrid, isCurrent && s.currentGrid]}>
      <View style={s.playerHeader}>
        <Text style={[s.playerName, isCurrent && { color: COLORS.gold }]}>
          {player.playerName} {isCurrent ? '(You)' : ''} {isActive ? '🎯' : ''}
        </Text>
        {score !== null && <Text style={s.gridScore}>Score: {score}</Text>}
      </View>
      <View style={s.gridContainer}>
        {Array.from({ length: rows }).map((_, row) => (
          <View key={row} style={s.gridRow}>
            {Array.from({ length: cols }).map((_, col) => {
              const idx = row * cols + col;
              const cell = player.grid[idx];
              const canTap = isCurrent && onCardPress && (
                (phase === 'flip-initial' && cell && !cell.faceUp) ||
                (drawnCard && (phase === 'playing' || phase === 'final-turns'))
              );
              return (
                <CardView
                  key={idx}
                  golfCard={cell}
                  small={small}
                  highlight={canTap ? true : false}
                  onPress={canTap ? () => onCardPress(idx) : undefined}
                />
              );
            })}
          </View>
        ))}
      </View>
      {player.roundScores.length > 0 && (
        <Text style={s.totalScore}>Total: {player.totalScore}</Text>
      )}
    </View>
  );
}

export function Golf({
  gameState,
  currentPlayerId,
  isHost,
  onFlipInitial,
  onDrawCard,
  onSwapCard,
  onDiscardDrawn,
  onStartNextRound,
  onReplay,
  onExit,
}: GolfProps) {
  const { phase, players, turnOrder, currentPlayerIndex, drawnCard, discardPile, deck, config, currentRound } = gameState;
  const currentTurnPlayerId = turnOrder[currentPlayerIndex];
  const isMyTurn = currentTurnPlayerId === currentPlayerId;
  const me = players.find(p => p.playerId === currentPlayerId);
  const topDiscard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const myFlipsLeft = gameState.initialFlipsRemaining[currentPlayerId] ?? 0;

  // Sort: current player first, then active player, then others
  const sortedPlayers = useMemo(() => {
    const sorted = [...players];
    sorted.sort((a, b) => {
      if (a.playerId === currentPlayerId) return -1;
      if (b.playerId === currentPlayerId) return 1;
      if (a.playerId === currentTurnPlayerId) return -1;
      if (b.playerId === currentTurnPlayerId) return 1;
      return 0;
    });
    return sorted;
  }, [players, currentPlayerId, currentTurnPlayerId]);

  // INITIAL FLIP PHASE
  if (phase === 'flip-initial') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <Text style={s.title}>⛳ Golf - Round {currentRound + 1}/{config.totalRounds}</Text>
        <Text style={s.subtitle}>
          {myFlipsLeft > 0
            ? `Tap ${myFlipsLeft} card${myFlipsLeft > 1 ? 's' : ''} to flip face up`
            : 'Waiting for others to flip...'}
        </Text>
        {sortedPlayers.map(p => (
          <PlayerGrid
            key={p.playerId}
            player={p}
            variant={config.variant}
            isActive={false}
            isCurrent={p.playerId === currentPlayerId}
            onCardPress={p.playerId === currentPlayerId && myFlipsLeft > 0 ? onFlipInitial : undefined}
            drawnCard={false}
            phase={phase}
          />
        ))}
      </ScrollView>
    );
  }

  // ROUND END
  if (phase === 'round-end') {
    const roundScores = players.map(p => ({
      name: p.playerName,
      round: p.roundScores[p.roundScores.length - 1] ?? 0,
      total: p.totalScore,
    })).sort((a, b) => a.total - b.total);

    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <Text style={s.title}>Round {currentRound + 1} Complete!</Text>
        {roundScores.map((p, i) => (
          <View key={i} style={s.scoreRow}>
            <Text style={s.scoreName}>{i === 0 ? '🏆 ' : ''}{p.name}</Text>
            <Text style={s.scoreValue}>Round: {p.round} | Total: {p.total}</Text>
          </View>
        ))}
        {sortedPlayers.map(p => (
          <PlayerGrid key={p.playerId} player={p} variant={config.variant}
            isActive={false} isCurrent={p.playerId === currentPlayerId}
            drawnCard={false} phase={phase} />
        ))}
        {isHost && (
          <Pressable style={s.actionButton} onPress={onStartNextRound}>
            <Text style={s.actionButtonText}>Next Round →</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  // GAME OVER
  if (phase === 'game-over') {
    const finalScores = [...players].sort((a, b) => a.totalScore - b.totalScore);
    const winner = finalScores[0];
    const losers = finalScores.filter(p => p.playerId !== winner.playerId);

    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <Text style={s.title}>⛳ Game Over!</Text>
        <Text style={s.winnerText}>🏆 {winner.playerName} wins with {winner.totalScore} points!</Text>
        {losers.length > 0 && (
          <Text style={s.drinkText}>🍺 {losers.map(l => l.playerName).join(', ')} - Take a drink!</Text>
        )}
        <View style={s.scoreBoard}>
          <Text style={s.scoreBoardTitle}>Final Scores</Text>
          {finalScores.map((p, i) => (
            <View key={p.playerId} style={s.scoreRow}>
              <Text style={s.scoreName}>{i + 1}. {p.playerName}</Text>
              <Text style={s.scoreValue}>{p.totalScore} pts</Text>
            </View>
          ))}
          <Text style={s.scoreBoardTitle}>Round-by-Round</Text>
          {finalScores.map(p => (
            <View key={p.playerId} style={s.scoreRow}>
              <Text style={s.scoreName}>{p.playerName}</Text>
              <Text style={s.scoreValue}>{p.roundScores.join(' | ')}</Text>
            </View>
          ))}
        </View>
        {isHost && (
          <View style={s.buttonRow}>
            <Pressable style={s.actionButton} onPress={onReplay}>
              <Text style={s.actionButtonText}>🔄 Play Again</Text>
            </Pressable>
            <Pressable style={[s.actionButton, { backgroundColor: COLORS.muted }]} onPress={onExit}>
              <Text style={s.actionButtonText}>Exit</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }

  // PLAYING / FINAL-TURNS
  const activePlayer = players.find(p => p.playerId === currentTurnPlayerId);
  const hasDrawn = !!drawnCard;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
      <Text style={s.title}>⛳ Golf - Round {currentRound + 1}/{config.totalRounds}</Text>
      {phase === 'final-turns' && (
        <Text style={s.finalTurnBanner}>⚡ Final turns! {gameState.knockerId === currentPlayerId ? 'You went out!' : `${players.find(p => p.playerId === gameState.knockerId)?.playerName} went out!`}</Text>
      )}
      <Text style={s.turnText}>
        {isMyTurn
          ? (hasDrawn ? 'Tap a card to swap, or discard below' : 'Draw from deck or discard pile')
          : `${activePlayer?.playerName}'s turn`}
      </Text>

      {/* Draw / Discard area */}
      <View style={s.pileArea}>
        <Pressable
          style={[s.pile, isMyTurn && !hasDrawn && s.pileActive]}
          onPress={isMyTurn && !hasDrawn && deck.length > 0 ? () => onDrawCard('deck') : undefined}
        >
          <Text style={s.pileLabel}>Deck</Text>
          <Text style={s.pileCount}>{deck.length}</Text>
          <Text style={s.cardBackText}>🂠</Text>
        </Pressable>

        <Pressable
          style={[s.pile, isMyTurn && !hasDrawn && topDiscard && s.pileActive]}
          onPress={isMyTurn && !hasDrawn && topDiscard ? () => onDrawCard('discard') : undefined}
        >
          <Text style={s.pileLabel}>Discard</Text>
          {topDiscard ? (
            <>
              <Text style={[s.cardRank, { color: SUIT_COLORS[topDiscard.suit] === 'red' ? COLORS.accent : COLORS.white }]}>
                {RANK_DISPLAY[topDiscard.rank]}
              </Text>
              <Text style={{ color: SUIT_COLORS[topDiscard.suit] === 'red' ? COLORS.accent : COLORS.white, fontSize: 18 }}>
                {SUIT_SYMBOLS[topDiscard.suit]}
              </Text>
            </>
          ) : (
            <Text style={s.pileEmpty}>Empty</Text>
          )}
        </Pressable>

        {/* Drawn card display */}
        {isMyTurn && hasDrawn && drawnCard && (
          <View style={s.drawnCardArea}>
            <Text style={s.drawnLabel}>Drawn:</Text>
            <View style={s.drawnCard}>
              <Text style={[s.cardRank, { color: SUIT_COLORS[drawnCard.suit] === 'red' ? COLORS.accent : COLORS.white }]}>
                {RANK_DISPLAY[drawnCard.rank]}{SUIT_SYMBOLS[drawnCard.suit]}
              </Text>
            </View>
            <Pressable style={s.discardButton} onPress={() => onDiscardDrawn()}>
              <Text style={s.discardButtonText}>Discard</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Player grids */}
      {sortedPlayers.map(p => (
        <PlayerGrid
          key={p.playerId}
          player={p}
          variant={config.variant}
          isActive={p.playerId === currentTurnPlayerId}
          isCurrent={p.playerId === currentPlayerId}
          onCardPress={
            p.playerId === currentPlayerId && isMyTurn && hasDrawn
              ? (idx) => {
                  onSwapCard(idx);
                }
              : undefined
          }
          drawnCard={hasDrawn}
          phase={phase}
        />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.white, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, color: COLORS.muted, textAlign: 'center', marginBottom: 12 },
  turnText: { fontSize: 16, color: COLORS.green, textAlign: 'center', marginBottom: 12 },
  finalTurnBanner: { fontSize: 14, color: COLORS.accent, textAlign: 'center', marginBottom: 8, fontWeight: 'bold' },
  
  pileArea: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 16 },
  pile: {
    width: 70, height: 95, borderRadius: 8, backgroundColor: COLORS.card,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.muted,
  },
  pileActive: { borderColor: COLORS.green },
  pileLabel: { fontSize: 10, color: COLORS.muted, position: 'absolute', top: 4 },
  pileCount: { fontSize: 12, color: COLORS.muted },
  pileEmpty: { fontSize: 11, color: COLORS.muted },
  
  drawnCardArea: { alignItems: 'center', gap: 4 },
  drawnLabel: { fontSize: 11, color: COLORS.muted },
  drawnCard: {
    width: 60, height: 80, borderRadius: 8, backgroundColor: COLORS.card,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.gold,
  },
  discardButton: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: COLORS.accent,
  },
  discardButtonText: { fontSize: 12, color: COLORS.white, fontWeight: 'bold' },

  playerGrid: { marginBottom: 16, padding: 12, borderRadius: 10, backgroundColor: COLORS.card },
  activeGrid: { borderWidth: 2, borderColor: COLORS.green },
  currentGrid: { borderWidth: 2, borderColor: COLORS.gold },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  playerName: { fontSize: 15, fontWeight: 'bold', color: COLORS.white },
  gridScore: { fontSize: 13, color: COLORS.green },
  totalScore: { fontSize: 12, color: COLORS.muted, textAlign: 'right', marginTop: 4 },
  gridContainer: { alignItems: 'center', gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },

  cardSlot: { borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  cardNormal: { width: 56, height: 76 },
  cardSmall: { width: 42, height: 58 },
  cardBackStyle: { backgroundColor: COLORS.cardBack, borderWidth: 1, borderColor: COLORS.muted },
  cardFace: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ccc' },
  cardHighlight: { borderWidth: 2, borderColor: COLORS.gold },
  cardBackText: { fontSize: 24 },
  cardRank: { fontSize: 16, fontWeight: 'bold' },
  cardSuit: { fontSize: 14 },

  scoreBoard: { backgroundColor: COLORS.card, borderRadius: 10, padding: 16, marginVertical: 12 },
  scoreBoardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.white, marginBottom: 8, marginTop: 8 },
  scoreRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#333',
  },
  scoreName: { fontSize: 14, color: COLORS.white },
  scoreValue: { fontSize: 14, color: COLORS.green },
  
  winnerText: { fontSize: 20, color: COLORS.gold, textAlign: 'center', marginVertical: 12, fontWeight: 'bold' },
  drinkText: { fontSize: 16, color: COLORS.accent, textAlign: 'center', marginBottom: 12 },

  actionButton: {
    backgroundColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 10, alignItems: 'center', marginTop: 12,
  },
  actionButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  buttonRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 12 },
});
