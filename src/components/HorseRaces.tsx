import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Modal } from 'react-native';
import { HorseRacesGameState, HorseRacesCard, ScratchedHorse } from '../types';
import { TRACK_LENGTHS } from '../services/horseRacesService';

interface Props {
  gameState: HorseRacesGameState;
  currentPlayerId: string;
  isHost: boolean;
  onRollScratch: () => Promise<void>;
  onRollRace: () => Promise<void>;
  onReplay: () => Promise<void>;
  onExit: () => void;
}

const HORSE_NUMBERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const HORSE_EMOJIS: { [key: number]: string } = {
  2: '🔴', 3: '🟠', 4: '🟡', 5: '🟢', 6: '🔵', 7: '🟣',
  8: '🟤', 9: '⚪', 10: '🩷', 11: '🩵', 12: '🖤',
};

export function HorseRaces({ gameState, currentPlayerId, isHost, onRollScratch, onRollRace, onReplay, onExit }: Props) {
  const [rolling, setRolling] = useState(false);
  const [showHand, setShowHand] = useState(false);
  const diceAnim = useRef(new Animated.Value(0)).current;
  
  const currentPlayer = gameState.players.find(p => p.playerId === currentPlayerId);
  const isMyTurn = gameState.turnOrder[gameState.currentPlayerIndex] === currentPlayerId;
  const currentTurnPlayer = gameState.players.find(p => p.playerId === gameState.turnOrder[gameState.currentPlayerIndex]);
  
  const myHorseNumbers = new Set(currentPlayer?.hand.map(c => c.value) || []);
  const scratchedNumbers = new Set(gameState.scratched.map(s => s.horseNumber));
  
  const handleRoll = async () => {
    setRolling(true);
    Animated.sequence([
      Animated.timing(diceAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(diceAnim, { toValue: -1, duration: 150, useNativeDriver: false }),
      Animated.timing(diceAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
    
    try {
      if (gameState.phase === 'scratching') await onRollScratch();
      else await onRollRace();
    } finally {
      setTimeout(() => setRolling(false), 300);
    }
  };
  
  const activeHorses = HORSE_NUMBERS.filter(n => !scratchedNumbers.has(n));
  const maxTrack = Math.max(...activeHorses.map(n => TRACK_LENGTHS[n]));
  
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>🏇 Horse Races</Text>
        <View style={s.headerRow}>
          <Text style={s.potText}>💰 Pot: {gameState.pot}</Text>
          <Text style={s.chipsText}>🪙 My Chips: {currentPlayer?.chips ?? 0}</Text>
        </View>
        <Text style={s.phaseText}>
          {gameState.phase === 'scratching' ? `Scratching Phase (${gameState.scratched.length}/4)` :
           gameState.phase === 'racing' ? 'Race in Progress!' : '🏆 Race Over!'}
        </Text>
      </View>
      
      {/* Turn indicator */}
      {gameState.phase !== 'finished' && (
        <View style={[s.turnBar, isMyTurn && s.turnBarActive]}>
          <Text style={s.turnText}>
            {isMyTurn ? "🎲 Your turn to roll!" : `⏳ ${currentTurnPlayer?.playerName}'s turn`}
          </Text>
        </View>
      )}
      
      {/* Penalty notification */}
      {gameState.lastRollPenalty != null && gameState.phase === 'racing' && (
        <View style={s.penaltyBar}>
          <Text style={s.penaltyText}>
            ⚠️ {gameState.lastRollPlayerName} rolled scratched #{gameState.lastRoll?.sum} — paid {gameState.lastRollPenalty} to pot!
          </Text>
        </View>
      )}
      
      {/* Last roll */}
      {gameState.lastRoll && gameState.phase === 'racing' && !gameState.lastRollPenalty && (
        <View style={s.rollBar}>
          <Text style={s.rollText}>
            🎲 {gameState.lastRollPlayerName} rolled {gameState.lastRoll.die1} + {gameState.lastRoll.die2} = {gameState.lastRoll.sum} → Horse #{gameState.lastRoll.sum} advances!
          </Text>
        </View>
      )}
      
      {/* Scratch roll result */}
      {gameState.phase === 'scratching' && gameState.lastScratchRoll != null && (
        <View style={s.rollBar}>
          <Text style={s.rollText}>
            🎲 Rolled {gameState.lastScratchRoll} — {gameState.lastScratchWasDuplicate ? 'Already scratched, re-roll!' : `Horse #${gameState.lastScratchRoll} scratched!`}
          </Text>
        </View>
      )}
      
      {/* Race Board */}
      <View style={s.board}>
        <Text style={s.finishLine}>🏁 FINISH LINE 🏁</Text>
        
        <View style={s.trackArea}>
          {activeHorses.map(num => {
            const trackLen = TRACK_LENGTHS[num];
            const pos = gameState.horsePositions[num] || 0;
            const isMyHorse = myHorseNumbers.has(num);
            const isWinner = gameState.winningHorse === num;
            
            return (
              <View key={num} style={[s.lane, isMyHorse && s.laneHighlight, isWinner && s.laneWinner]}>
                <Text style={s.laneLabel}>#{num}</Text>
                <View style={s.track}>
                  {Array.from({ length: trackLen }).map((_, i) => {
                    const spaceIndex = trackLen - 1 - i; // top = finish, bottom = start
                    const isHere = spaceIndex === pos && pos < trackLen;
                    const isFinished = pos >= trackLen && spaceIndex === trackLen - 1;
                    return (
                      <View key={i} style={[s.space, (isHere || isFinished) && s.spaceActive]}>
                        {(isHere || isFinished) && <Text style={s.horse}>{HORSE_EMOJIS[num]}</Text>}
                      </View>
                    );
                  })}
                </View>
                <Text style={s.trackInfo}>{pos}/{trackLen}</Text>
              </View>
            );
          })}
        </View>
        
        <Text style={s.startGate}>🚦 STARTING GATE 🚦</Text>
        
        {/* Scratched area */}
        {gameState.scratched.length > 0 && (
          <View style={s.scratchedArea}>
            <Text style={s.scratchedTitle}>❌ Scratched</Text>
            <View style={s.scratchedRow}>
              {gameState.scratched.map(sc => (
                <View key={sc.horseNumber} style={s.scratchedBadge}>
                  <Text style={s.scratchedText}>#{sc.horseNumber}</Text>
                  <Text style={s.scratchedPenalty}>-{sc.penaltyOrder}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
      
      {/* Roll button */}
      {isMyTurn && gameState.phase !== 'finished' && (
        <Pressable style={[s.rollButton, rolling && s.rollButtonDisabled]} onPress={handleRoll} disabled={rolling}>
          <Animated.Text style={[s.rollButtonText, { transform: [{ rotate: diceAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] }) }] }]}>
            {rolling ? '🎲 Rolling...' : '🎲 Roll Dice'}
          </Animated.Text>
        </Pressable>
      )}
      
      {/* Hand button */}
      <Pressable style={s.handButton} onPress={() => setShowHand(!showHand)}>
        <Text style={s.handButtonText}>🃏 {showHand ? 'Hide' : 'Show'} My Hand ({currentPlayer?.hand.length || 0} cards)</Text>
      </Pressable>
      
      {showHand && currentPlayer && (
        <View style={s.handArea}>
          {currentPlayer.hand.length === 0 ? (
            <Text style={s.handEmpty}>No cards remaining</Text>
          ) : (
            <View style={s.handCards}>
              {currentPlayer.hand.map((card, i) => (
                <View key={i} style={[s.card, card.suit === 'hearts' || card.suit === 'diamonds' ? s.cardRed : s.cardBlack]}>
                  <Text style={s.cardText}>{card.label}</Text>
                  <Text style={s.cardHorse}>Horse #{card.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      
      {/* Player chips */}
      <View style={s.playersArea}>
        <Text style={s.playersTitle}>Players</Text>
        {gameState.players.map(p => (
          <View key={p.playerId} style={[s.playerRow, p.playerId === gameState.turnOrder[gameState.currentPlayerIndex] && gameState.phase !== 'finished' && s.playerActive]}>
            <Text style={s.playerName}>{p.playerName} {p.playerId === currentPlayerId ? '(You)' : ''}</Text>
            <Text style={s.playerChips}>🪙 {p.chips}</Text>
          </View>
        ))}
      </View>
      
      {/* Finished state */}
      {gameState.phase === 'finished' && (
        <View style={s.finishedArea}>
          <Text style={s.winnerTitle}>🏆 Horse #{gameState.winningHorse} Wins!</Text>
          {gameState.winnerPlayerIds.length > 0 && gameState.winnerPlayerIds[0] !== '_none_' ? (
            <>
              <Text style={s.winnerInfo}>
                Winners split the pot ({gameState.pot} chips → {gameState.winnerPayout} each):
              </Text>
              {gameState.winnerPlayerIds.map(id => {
                const p = gameState.players.find(pl => pl.playerId === id);
                return <Text key={id} style={s.winnerName}>🎉 {p?.playerName}</Text>;
              })}
              <Text style={s.drinkText}>Everyone else — take a drink! 🍺</Text>
            </>
          ) : (
            <Text style={s.drinkText}>Nobody had cards for that horse! Everyone drinks! 🍺</Text>
          )}
          
          <View style={s.endButtons}>
            {isHost && (
              <Pressable style={s.replayButton} onPress={onReplay}>
                <Text style={s.replayButtonText}>🔄 Play Again</Text>
              </Pressable>
            )}
            <Pressable style={s.exitButton} onPress={onExit}>
              <Text style={s.exitButtonText}>🚪 Exit</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  headerRow: { flexDirection: 'row', gap: 20, marginBottom: 6 },
  potText: { fontSize: 18, fontWeight: 'bold', color: '#e94560' },
  chipsText: { fontSize: 18, color: '#ffd700' },
  phaseText: { fontSize: 16, color: '#8b8b9e' },
  
  turnBar: { backgroundColor: '#16213e', borderRadius: 8, padding: 10, marginBottom: 8, alignItems: 'center' },
  turnBarActive: { backgroundColor: '#0f3460', borderWidth: 2, borderColor: '#e94560' },
  turnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  penaltyBar: { backgroundColor: '#4a1520', borderRadius: 8, padding: 10, marginBottom: 8, alignItems: 'center' },
  penaltyText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  
  rollBar: { backgroundColor: '#162a1e', borderRadius: 8, padding: 10, marginBottom: 8, alignItems: 'center' },
  rollText: { color: '#4ade80', fontSize: 14, fontWeight: '600' },
  
  board: { backgroundColor: '#16213e', borderRadius: 12, padding: 12, marginBottom: 12 },
  finishLine: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#ffd700', marginBottom: 8, letterSpacing: 2 },
  startGate: { textAlign: 'center', fontSize: 14, color: '#8b8b9e', marginTop: 8 },
  
  trackArea: { flexDirection: 'row', justifyContent: 'space-around', gap: 2 },
  lane: { alignItems: 'center', flex: 1, borderRadius: 6, padding: 2 },
  laneHighlight: { backgroundColor: 'rgba(233,69,96,0.15)' },
  laneWinner: { backgroundColor: 'rgba(255,215,0,0.2)' },
  laneLabel: { fontSize: 11, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  track: { gap: 1, width: '100%' },
  space: { height: 18, backgroundColor: '#0f3460', borderRadius: 2, justifyContent: 'center', alignItems: 'center', marginVertical: 1 },
  spaceActive: { backgroundColor: '#e94560' },
  horse: { fontSize: 10 },
  trackInfo: { fontSize: 9, color: '#8b8b9e', marginTop: 2 },
  
  scratchedArea: { marginTop: 12, alignItems: 'center' },
  scratchedTitle: { color: '#e94560', fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  scratchedRow: { flexDirection: 'row', gap: 12 },
  scratchedBadge: { backgroundColor: '#2a1520', borderRadius: 8, padding: 8, alignItems: 'center', minWidth: 50 },
  scratchedText: { color: '#e94560', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'line-through' },
  scratchedPenalty: { color: '#ff8888', fontSize: 11 },
  
  rollButton: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  rollButtonDisabled: { opacity: 0.6 },
  rollButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  
  handButton: { backgroundColor: '#16213e', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 8 },
  handButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  handArea: { marginBottom: 12 },
  handEmpty: { color: '#8b8b9e', textAlign: 'center', fontStyle: 'italic' },
  handCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  card: { borderRadius: 8, padding: 8, minWidth: 55, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  cardRed: { backgroundColor: '#2a1520' },
  cardBlack: { backgroundColor: '#1a1a2e' },
  cardText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  cardHorse: { fontSize: 9, color: '#8b8b9e', marginTop: 2 },
  
  playersArea: { backgroundColor: '#16213e', borderRadius: 10, padding: 12, marginBottom: 12 },
  playersTitle: { color: '#8b8b9e', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
  playerActive: { backgroundColor: 'rgba(233,69,96,0.2)' },
  playerName: { color: '#fff', fontSize: 14 },
  playerChips: { color: '#ffd700', fontSize: 14 },
  
  finishedArea: { backgroundColor: '#16213e', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 12 },
  winnerTitle: { fontSize: 24, fontWeight: 'bold', color: '#ffd700', marginBottom: 12 },
  winnerInfo: { color: '#fff', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  winnerName: { color: '#4ade80', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  drinkText: { color: '#e94560', fontSize: 16, fontWeight: '600', marginTop: 12 },
  endButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  replayButton: { backgroundColor: '#e94560', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  replayButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  exitButton: { backgroundColor: '#333', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  exitButtonText: { color: '#fff', fontSize: 16 },
});
