import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  FishbowlGameState,
  FISHBOWL_ROUNDS,
} from '../types';

interface FishbowlProps {
  gameState: FishbowlGameState;
  currentPlayerId: string;
  isHost: boolean;
  onSubmitSlip: (text: string) => Promise<void>;
  onSetReady: (ready: boolean) => Promise<void>;
  onAssignTeam: (playerId: string, teamId: 'team1' | 'team2') => Promise<void>;
  onAutoAssignTeams: () => Promise<void>;
  onStartGame: () => Promise<void>;
  onStartTurn: () => Promise<void>;
  onCorrectGuess: () => Promise<{ roundComplete: boolean }>;
  onSkipSlip: () => Promise<void>;
  onEndTurn: () => Promise<void>;
  onEndRound: () => Promise<{ gameOver: boolean }>;
  onContinueToNextRound: () => Promise<void>;
  onReplay: () => Promise<void>;
  onExit: () => void;
}

export function Fishbowl({
  gameState,
  currentPlayerId,
  isHost,
  onSubmitSlip,
  onSetReady,
  onAssignTeam,
  onAutoAssignTeams,
  onStartGame,
  onStartTurn,
  onCorrectGuess,
  onSkipSlip,
  onEndTurn,
  onEndRound,
  onContinueToNextRound,
  onReplay,
  onExit,
}: FishbowlProps) {
  const [slipInput, setSlipInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPlayer = gameState.players.find(p => p.playerId === currentPlayerId);
  const isClueGiver = gameState.currentTurn?.clueGiverId === currentPlayerId;
  const myTeam = currentPlayer?.teamId ? gameState.teams[currentPlayer.teamId] : null;
  const isMyTeamsTurn = gameState.currentTurn?.teamId === currentPlayer?.teamId;

  // Timer effect
  useEffect(() => {
    if (gameState.currentTurn && !gameState.currentTurn.isPaused && gameState.phase === 'playing') {
      const elapsed = Math.floor((Date.now() - gameState.currentTurn.startedAt) / 1000);
      const remaining = Math.max(0, gameState.config.turnTimeSeconds - elapsed);
      setTimeLeft(remaining);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Timer ran out - clue giver should end turn
            if (isClueGiver) {
              onEndTurn();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [gameState.currentTurn?.startedAt, gameState.phase]);

  const handleSubmitSlip = async () => {
    if (!slipInput.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmitSlip(slipInput.trim());
      setSlipInput('');
    } catch (error) {
      console.error('Submit slip error:', error);
      Alert.alert('Error', 'Failed to submit slip');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCorrectGuess = async () => {
    try {
      const { roundComplete } = await onCorrectGuess();
      if (roundComplete) {
        // Bowl is empty - end round
        const { gameOver } = await onEndRound();
        if (!gameOver) {
          Alert.alert('Round Complete!', 'All slips guessed! Ready for the next round.');
        }
      }
    } catch (error) {
      console.error('Correct guess error:', error);
    }
  };

  // SETUP PHASE - Writing slips
  if (gameState.phase === 'setup') {
    const slipsRemaining = gameState.config.slipsPerPlayer - (currentPlayer?.slipsSubmitted || 0);
    const canSubmit = slipsRemaining > 0 && slipInput.trim().length > 0;

    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>🐟 Fishbowl</Text>
          <Text style={styles.subtitle}>Write Your Clues</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {slipsRemaining > 0 
                ? `Write ${slipsRemaining} more clue${slipsRemaining > 1 ? 's' : ''}`
                : 'All clues submitted!'}
            </Text>
            <Text style={styles.hint}>
              Good clues: famous people, movies, TV characters, simple objects, or inside jokes!
            </Text>

            {slipsRemaining > 0 && (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter a clue..."
                  placeholderTextColor="#6b6b7e"
                  value={slipInput}
                  onChangeText={setSlipInput}
                  onSubmitEditing={handleSubmitSlip}
                  maxLength={50}
                />
                <Pressable
                  style={[styles.submitButton, !canSubmit && styles.buttonDisabled]}
                  onPress={handleSubmitSlip}
                  disabled={!canSubmit || isSubmitting}
                >
                  <Text style={styles.submitButtonText}>Add</Text>
                </Pressable>
              </View>
            )}

            {slipsRemaining === 0 && !currentPlayer?.isReady && (
              <Pressable
                style={styles.readyButton}
                onPress={() => onSetReady(true)}
              >
                <Text style={styles.readyButtonText}>✓ I'm Ready!</Text>
              </Pressable>
            )}

            {currentPlayer?.isReady && (
              <View style={styles.readyBadge}>
                <Text style={styles.readyBadgeText}>✓ Ready</Text>
              </View>
            )}
          </View>

          <View style={styles.playersCard}>
            <Text style={styles.cardTitle}>Players</Text>
            {gameState.players.map(p => (
              <View key={p.playerId} style={styles.playerRow}>
                <Text style={styles.playerName}>
                  {p.playerName}
                  {p.playerId === currentPlayerId && ' (You)'}
                </Text>
                <Text style={styles.playerStatus}>
                  {p.slipsSubmitted}/{gameState.config.slipsPerPlayer} slips
                  {p.isReady && ' ✓'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  // TEAMS PHASE - Assigning teams
  if (gameState.phase === 'teams') {
    const team1 = gameState.teams.team1;
    const team2 = gameState.teams.team2;
    const allAssigned = gameState.players.every(p => p.teamId !== null);

    return (
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>🐟 Fishbowl</Text>
          <Text style={styles.subtitle}>Pick Your Teams</Text>

          {isHost && (
            <Pressable style={styles.autoButton} onPress={onAutoAssignTeams}>
              <Text style={styles.autoButtonText}>🎲 Randomize Teams</Text>
            </Pressable>
          )}

          <View style={styles.teamsContainer}>
            <View style={styles.teamCard}>
              <Text style={styles.teamTitle}>🔵 {team1.name}</Text>
              {team1.playerIds.map(id => {
                const p = gameState.players.find(pl => pl.playerId === id);
                return (
                  <Text key={id} style={styles.teamMember}>
                    {p?.playerName}
                    {id === currentPlayerId && ' (You)'}
                  </Text>
                );
              })}
              {currentPlayer?.teamId !== 'team1' && (
                <Pressable
                  style={styles.joinTeamButton}
                  onPress={() => onAssignTeam(currentPlayerId, 'team1')}
                >
                  <Text style={styles.joinTeamText}>Join Team 1</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.teamCard}>
              <Text style={styles.teamTitle}>🔴 {team2.name}</Text>
              {team2.playerIds.map(id => {
                const p = gameState.players.find(pl => pl.playerId === id);
                return (
                  <Text key={id} style={styles.teamMember}>
                    {p?.playerName}
                    {id === currentPlayerId && ' (You)'}
                  </Text>
                );
              })}
              {currentPlayer?.teamId !== 'team2' && (
                <Pressable
                  style={styles.joinTeamButton}
                  onPress={() => onAssignTeam(currentPlayerId, 'team2')}
                >
                  <Text style={styles.joinTeamText}>Join Team 2</Text>
                </Pressable>
              )}
            </View>
          </View>

          {isHost && allAssigned && (
            <Pressable style={styles.startButton} onPress={onStartGame}>
              <Text style={styles.startButtonText}>Start Game!</Text>
            </Pressable>
          )}

          {!allAssigned && (
            <Text style={styles.waitingText}>
              Waiting for all players to join a team...
            </Text>
          )}
        </View>
      </ScrollView>
    );
  }

  // ROUND END PHASE
  if (gameState.phase === 'round-end') {
    const nextRound = FISHBOWL_ROUNDS[gameState.currentRound];
    
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.title}>Round Complete!</Text>
          
          <View style={styles.scoresCard}>
            <Text style={styles.scoreTeam}>
              🔵 {gameState.teams.team1.name}: {gameState.teams.team1.score}
            </Text>
            <Text style={styles.scoreTeam}>
              🔴 {gameState.teams.team2.name}: {gameState.teams.team2.score}
            </Text>
          </View>

          <View style={styles.nextRoundCard}>
            <Text style={styles.nextRoundTitle}>Next: {nextRound.name}</Text>
            <Text style={styles.nextRoundDesc}>{nextRound.description}</Text>
          </View>

          {isHost && (
            <Pressable style={styles.startButton} onPress={onContinueToNextRound}>
              <Text style={styles.startButtonText}>Start Round {gameState.currentRound + 1}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // GAME OVER PHASE
  if (gameState.phase === 'game-over') {
    const team1 = gameState.teams.team1;
    const team2 = gameState.teams.team2;
    const winner = team1.score > team2.score ? team1 : team2.score > team1.score ? team2 : null;

    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.title}>🎉 Game Over!</Text>
          
          {winner ? (
            <Text style={styles.winnerText}>
              {winner.id === 'team1' ? '🔵' : '🔴'} {winner.name} Wins!
            </Text>
          ) : (
            <Text style={styles.winnerText}>It's a Tie!</Text>
          )}

          <View style={styles.scoresCard}>
            <Text style={styles.scoreTeam}>
              🔵 {team1.name}: {team1.score} points
            </Text>
            <Text style={styles.scoreTeam}>
              🔴 {team2.name}: {team2.score} points
            </Text>
          </View>

          <Pressable style={styles.replayButton} onPress={onReplay}>
            <Text style={styles.replayButtonText}>🔄 Play Again</Text>
          </Pressable>

          <Pressable style={styles.exitButton} onPress={onExit}>
            <Text style={styles.exitButtonText}>Exit to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // PLAYING PHASE
  const currentRoundInfo = FISHBOWL_ROUNDS[gameState.currentRound];
  const turn = gameState.currentTurn;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roundTitle}>
          Round {gameState.currentRound + 1}: {currentRoundInfo.name}
        </Text>
        <Text style={styles.roundDesc}>{currentRoundInfo.description}</Text>
        
        <View style={styles.scoresRow}>
          <Text style={[styles.scoreSmall, gameState.currentTeamId === 'team1' && styles.activeTeam]}>
            🔵 {gameState.teams.team1.score}
          </Text>
          <Text style={styles.bowlCount}>🐟 {gameState.bowl.length} in bowl</Text>
          <Text style={[styles.scoreSmall, gameState.currentTeamId === 'team2' && styles.activeTeam]}>
            🔴 {gameState.teams.team2.score}
          </Text>
        </View>
      </View>

      {/* No active turn - waiting to start */}
      {!turn && (
        <View style={styles.centerContent}>
          <Text style={styles.turnText}>
            {gameState.currentTeamId === 'team1' ? '🔵' : '🔴'} {gameState.teams[gameState.currentTeamId].name}'s Turn
          </Text>
          
          {/* Find next clue giver */}
          {(() => {
            const team = gameState.teams[gameState.currentTeamId];
            const nextGiverId = team.playerIds[gameState.turnOrderIndex % team.playerIds.length];
            const nextGiver = gameState.players.find(p => p.playerId === nextGiverId);
            const isMe = nextGiverId === currentPlayerId;

            return (
              <>
                <Text style={styles.clueGiverText}>
                  {isMe ? "You're" : `${nextGiver?.playerName} is`} giving clues
                </Text>
                {isMe && (
                  <Pressable style={styles.startTurnButton} onPress={onStartTurn}>
                    <Text style={styles.startTurnText}>Start Turn ({gameState.config.turnTimeSeconds}s)</Text>
                  </Pressable>
                )}
              </>
            );
          })()}
        </View>
      )}

      {/* Active turn */}
      {turn && (
        <View style={styles.turnContent}>
          {/* Timer */}
          <View style={[styles.timer, timeLeft <= 10 && styles.timerWarning]}>
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>

          <Text style={styles.turnLabel}>
            {turn.clueGiverName} is giving clues for {turn.teamId === 'team1' ? '🔵' : '🔴'}
          </Text>
          <Text style={styles.guessedCount}>
            {turn.slipsGuessedThisTurn} guessed this turn
          </Text>

          {/* Clue Giver View */}
          {isClueGiver && turn.currentSlip && (
            <View style={styles.clueCard}>
              <Text style={styles.clueLabel}>Your Clue:</Text>
              <Text style={styles.clueText}>{turn.currentSlip.text}</Text>
              
              <View style={styles.clueButtons}>
                <Pressable style={styles.correctButton} onPress={handleCorrectGuess}>
                  <Text style={styles.correctButtonText}>✓ Got It!</Text>
                </Pressable>
                <Pressable style={styles.skipButton} onPress={onSkipSlip}>
                  <Text style={styles.skipButtonText}>Skip →</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Team Guesser View */}
          {!isClueGiver && isMyTeamsTurn && (
            <View style={styles.guessCard}>
              <Text style={styles.guessLabel}>GUESS!</Text>
              <Text style={styles.guessHint}>
                {currentRoundInfo.type === 'describe' && 'Listen to the clues!'}
                {currentRoundInfo.type === 'charades' && 'Watch the actions!'}
                {currentRoundInfo.type === 'one-word' && 'One word only!'}
                {currentRoundInfo.type === 'silhouette' && 'Watch the shadow!'}
              </Text>
            </View>
          )}

          {/* Other Team View */}
          {!isMyTeamsTurn && (
            <View style={styles.watchCard}>
              <Text style={styles.watchLabel}>Watch & Remember</Text>
              <Text style={styles.watchHint}>
                Pay attention - you'll need to remember these clues!
              </Text>
            </View>
          )}

          {/* End turn early button for clue giver */}
          {isClueGiver && (
            <Pressable style={styles.endTurnButton} onPress={onEndTurn}>
              <Text style={styles.endTurnText}>End Turn Early</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#8b8b9e',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#8b8b9e',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  readyButton: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  readyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  readyBadge: {
    backgroundColor: '#22c55e33',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  readyBadgeText: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: 16,
  },
  playersCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  playerName: {
    color: '#ffffff',
    fontSize: 16,
  },
  playerStatus: {
    color: '#8b8b9e',
    fontSize: 14,
  },
  autoButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  autoButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  teamsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  teamCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    minHeight: 150,
  },
  teamTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  teamMember: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 4,
  },
  joinTeamButton: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  joinTeamText: {
    color: '#8b8b9e',
    fontSize: 14,
  },
  startButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
  },
  waitingText: {
    color: '#8b8b9e',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  scoresCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    marginVertical: 20,
    width: '100%',
    maxWidth: 300,
  },
  scoreTeam: {
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
    marginVertical: 8,
  },
  nextRoundCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    width: '100%',
    maxWidth: 300,
  },
  nextRoundTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e94560',
    textAlign: 'center',
    marginBottom: 8,
  },
  nextRoundDesc: {
    fontSize: 14,
    color: '#8b8b9e',
    textAlign: 'center',
  },
  winnerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginVertical: 16,
  },
  replayButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: '100%',
    maxWidth: 250,
  },
  replayButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
    textAlign: 'center',
  },
  exitButton: {
    backgroundColor: '#6b7280',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 250,
  },
  exitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  roundTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e94560',
    textAlign: 'center',
  },
  roundDesc: {
    fontSize: 14,
    color: '#8b8b9e',
    textAlign: 'center',
    marginTop: 4,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  scoreSmall: {
    fontSize: 18,
    color: '#8b8b9e',
  },
  activeTeam: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  bowlCount: {
    fontSize: 14,
    color: '#8b8b9e',
  },
  turnContent: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  timer: {
    backgroundColor: '#22c55e',
    borderRadius: 50,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerWarning: {
    backgroundColor: '#ef4444',
  },
  timerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  turnLabel: {
    fontSize: 16,
    color: '#8b8b9e',
    marginBottom: 4,
  },
  guessedCount: {
    fontSize: 14,
    color: '#22c55e',
    marginBottom: 24,
  },
  turnText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  clueGiverText: {
    fontSize: 18,
    color: '#8b8b9e',
    marginBottom: 24,
  },
  startTurnButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  startTurnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
  },
  clueCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  clueLabel: {
    fontSize: 14,
    color: '#8b8b9e',
    marginBottom: 8,
  },
  clueText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
  },
  clueButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  correctButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  correctButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
  },
  skipButton: {
    backgroundColor: '#6b7280',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
  },
  guessCard: {
    backgroundColor: '#22c55e22',
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  guessLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  guessHint: {
    fontSize: 16,
    color: '#8b8b9e',
  },
  watchCard: {
    backgroundColor: '#6b728022',
    borderWidth: 2,
    borderColor: '#6b7280',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  watchLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: '#8b8b9e',
    marginBottom: 8,
  },
  watchHint: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  endTurnButton: {
    marginTop: 24,
    padding: 12,
  },
  endTurnText: {
    color: '#8b8b9e',
    fontSize: 14,
  },
});
