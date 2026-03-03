import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { PlayingCard } from './PlayingCard';
import { IrishPokerGameState } from '../types';
import { Card, getCardDisplay, RANK_DISPLAY } from '../utils/cards';

interface RideTheBusProps {
  gameState: IrishPokerGameState;
  currentPlayerId: string;
  isHost: boolean;
  onFlipCard: () => Promise<void>;
  onGiveCard: (toPlayerId: string) => Promise<{ cardsRemaining: number; totalRemaining: number }>;
  onFinishGiving: () => Promise<void>;
  onAcknowledgeDrink: () => Promise<void>;
  onRiderGuess: (guess: string) => Promise<{ correct: boolean; escaped: boolean }>;
  onContinueRiding: () => Promise<void>;
}

export function RideTheBus({
  gameState,
  currentPlayerId,
  isHost,
  onFlipCard,
  onGiveCard,
  onFinishGiving,
  onAcknowledgeDrink,
  onRiderGuess,
  onContinueRiding,
}: RideTheBusProps) {
  const rtb = gameState.rideTheBus;
  const [isGuessing, setIsGuessing] = useState(false);
  const [isGiving, setIsGiving] = useState(false);
  
  if (!rtb) return null;

  // All state comes from Firebase now - synced across all players
  const currentFlipIndex = rtb.currentFlipIndex;
  const isGiveRow = rtb.phase === 'overtime' ? true : (currentFlipIndex % 2 === 0);
  const rowIndex = rtb.phase === 'overtime' ? currentFlipIndex - 8 : Math.floor(currentFlipIndex / 2);
  
  const flippedCard = rtb.currentFlipCard;
  const matchingPlayers = rtb.matchingPlayerIds || [];
  const waitingForAssignment = rtb.waitingForAssignment;
  const waitingForDrinkAck = rtb.waitingForDrinkAck;
  
  // Get current player's rtbHand
  const myPlayer = gameState.players.find(p => p.playerId === currentPlayerId);
  const myHand: Card[] = Array.isArray(myPlayer?.rtbHand) 
    ? myPlayer.rtbHand 
    : Object.values(myPlayer?.rtbHand || {}) as Card[];
  
  // Check if I'm one of the ORIGINAL matching players (not a receiver)
  const iAmOriginalMatcher = matchingPlayers.includes(currentPlayerId);
  
  // Check if I have cards matching the flipped card rank AND I'm an original matcher
  const myMatchingCards = (flippedCard && iAmOriginalMatcher)
    ? myHand.filter(c => c && c.rank === flippedCard.rank)
    : [];
  const iHaveMatchingCards = myMatchingCards.length > 0;
  
  // Find player with most cards (likely bus rider)
  const cardCounts = gameState.players.map(p => {
    const hand = Array.isArray(p.rtbHand) ? p.rtbHand : Object.values(p.rtbHand || {}) as Card[];
    return { playerId: p.playerId, count: hand.length };
  });
  const maxCards = Math.max(...cardCounts.map(c => c.count));

  const handleFlip = async () => {
    try {
      await onFlipCard();
    } catch (error) {
      console.error('Flip error:', error);
    }
  };

  const handleGiveCard = async (toPlayerId: string) => {
    if (isGiving || !flippedCard) return;
    setIsGiving(true);
    try {
      const result = await onGiveCard(toPlayerId);
      console.log('Give result:', result);
      // Keep isGiving true briefly to let Firebase state propagate
      // This prevents double-clicks during the update
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Give card error:', error);
    } finally {
      setIsGiving(false);
    }
  };

  const handleFinishGiving = async () => {
    try {
      await onFinishGiving();
    } catch (error) {
      console.error('Finish giving error:', error);
    }
  };

  const handleAcknowledgeDrink = async () => {
    try {
      await onAcknowledgeDrink();
    } catch (error) {
      console.error('Acknowledge error:', error);
    }
  };

  const handleRiderGuess = async (guess: string) => {
    if (isGuessing) return;
    setIsGuessing(true);
    try {
      await onRiderGuess(guess);
    } catch (error) {
      console.error('Rider guess error:', error);
    } finally {
      setIsGuessing(false);
    }
  };

  const handleContinueRiding = async () => {
    try {
      await onContinueRiding();
    } catch (error) {
      console.error('Continue riding error:', error);
    }
  };

  // Render all player hands (shows rtbHand - current cards during RTB)
  const renderPlayerHands = () => {
    return (
      <View style={styles.playerHandsSection}>
        <Text style={styles.sectionLabel}>Current Hands</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {gameState.players.map(player => {
            const rtbHand: Card[] = Array.isArray(player.rtbHand) 
              ? player.rtbHand 
              : Object.values(player.rtbHand || {}) as Card[];
            const cardCount = rtbHand.length;
            const isLeading = cardCount === maxCards && maxCards > 0;
            const isMe = player.playerId === currentPlayerId;
            
            return (
              <View 
                key={player.playerId} 
                style={[
                  styles.playerHandCard,
                  isLeading && styles.playerHandCardLeading,
                ]}
              >
                <Text style={[
                  styles.playerHandName,
                  isMe && styles.playerHandNameYou
                ]}>
                  {player.playerName}
                  {isMe ? ' (You)' : ''}
                </Text>
                <View style={styles.playerHandCards}>
                  {rtbHand.length > 0 ? (
                    rtbHand.map((card, idx) => (
                      <PlayingCard
                        key={card?.id || idx}
                        card={card}
                        revealed={true}
                        size="small"
                      />
                    ))
                  ) : (
                    <Text style={styles.noCardsText}>No cards!</Text>
                  )}
                </View>
                <Text style={[styles.cardCountText, isLeading && styles.cardCountLeading]}>
                  {cardCount} card{cardCount !== 1 ? 's' : ''}
                  {isLeading && ' 🚌'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // FLIP PHASE UI
  if (rtb.phase === 'flip' || rtb.phase === 'overtime') {
    const isOvertime = rtb.phase === 'overtime';
    const giveRow = Array.isArray(rtb.giveRow) ? rtb.giveRow : Object.values(rtb.giveRow || {});
    const takeRow = Array.isArray(rtb.takeRow) ? rtb.takeRow : Object.values(rtb.takeRow || {});
    
    // Determine which cards should be revealed
    const getGiveCardRevealed = (idx: number) => {
      if (isOvertime) return idx < (currentFlipIndex - 8);
      const giveFlipsDone = Math.ceil(currentFlipIndex / 2);
      if (isGiveRow && idx === rowIndex && flippedCard) return true;
      return idx < giveFlipsDone - (isGiveRow ? 0 : 0);
    };
    
    const getTakeCardRevealed = (idx: number) => {
      const takeFlipsDone = Math.floor(currentFlipIndex / 2);
      if (!isGiveRow && idx === rowIndex && flippedCard) return true;
      return idx < takeFlipsDone;
    };
    
    return (
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.container}>
          <Text style={styles.title}>🚌 Ride the Bus</Text>
          <Text style={styles.phase}>
            {isOvertime ? '⚡ OVERTIME!' : `Flip ${currentFlipIndex + 1} of 8`}
          </Text>
          
          {/* Show all player hands */}
          {renderPlayerHands()}

        {/* Card Rows */}
        <View style={styles.rowsContainer}>
          {/* Give Row */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>🎁 GIVE</Text>
            <View style={styles.cardsRow}>
              {giveRow.map((card, idx) => (
                <View key={`give-${idx}`} style={styles.cardSlot}>
                  <PlayingCard
                    card={card as Card}
                    revealed={getGiveCardRevealed(idx) || (isGiveRow && idx === rowIndex && !!flippedCard)}
                    size="small"
                    highlight={isGiveRow && idx === rowIndex && !flippedCard}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Take Row */}
          {!isOvertime && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>🍺 TAKE</Text>
              <View style={styles.cardsRow}>
                {takeRow.map((card, idx) => (
                  <View key={`take-${idx}`} style={styles.cardSlot}>
                    <PlayingCard
                      card={card as Card}
                      revealed={getTakeCardRevealed(idx) || (!isGiveRow && idx === rowIndex && !!flippedCard)}
                      size="small"
                      highlight={!isGiveRow && idx === rowIndex && !flippedCard}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Current action */}
        <View style={styles.actionArea}>
          <Text style={styles.actionLabel}>
            {isGiveRow ? '🎁 GIVE row' : '🍺 TAKE row'}
          </Text>
          
          {/* Show flip button when not waiting for anything */}
          {!flippedCard && !waitingForAssignment && !waitingForDrinkAck && (
            <Pressable
              style={styles.flipButton}
              onPress={handleFlip}
            >
              <Text style={styles.flipButtonText}>Flip Card</Text>
            </Pressable>
          )}
          
          {/* Show flipped card info */}
          {flippedCard && (
            <View style={styles.flippedInfo}>
              <Text style={styles.flippedText}>
                Flipped: {getCardDisplay(flippedCard)}
              </Text>
              <Text style={styles.matchingText}>
                {matchingPlayers.length > 0 
                  ? `Matched by: ${matchingPlayers.map(id => 
                      gameState.players.find(p => p.playerId === id)?.playerName
                    ).join(', ')}`
                  : 'No matches'}
              </Text>
            </View>
          )}
          
          {/* TAKE row - show drink acknowledgment button */}
          {waitingForDrinkAck && flippedCard && (
            <View style={styles.drinkAckArea}>
              <Text style={styles.drinkText}>
                🍺 {matchingPlayers.map(id => 
                  gameState.players.find(p => p.playerId === id)?.playerName
                ).join(', ')} - DRINK!
              </Text>
              <Pressable
                style={styles.ackButton}
                onPress={handleAcknowledgeDrink}
              >
                <Text style={styles.ackButtonText}>Cheers! Next Card 🍻</Text>
              </Pressable>
            </View>
          )}
        </View>


        {/* Give Card Modal - shows for GIVE row when waiting for assignment */}
        {waitingForAssignment && flippedCard && (
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                {RANK_DISPLAY[flippedCard.rank]} flipped!
              </Text>
              
              {/* If I have matching cards, I MUST give them */}
              {iHaveMatchingCards ? (
                <>
                  <Text style={styles.modalSubtitle}>
                    You have {myMatchingCards.length} {RANK_DISPLAY[flippedCard.rank]}{myMatchingCards.length > 1 ? 's' : ''} - give to:
                  </Text>
                  <View style={styles.assignButtons}>
                    {gameState.players
                      .filter(p => p.playerId !== currentPlayerId)
                      .map(p => (
                        <Pressable
                          key={p.playerId}
                          style={[styles.assignButton, isGiving && styles.buttonDisabled]}
                          onPress={() => handleGiveCard(p.playerId)}
                          disabled={isGiving}
                        >
                          <Text style={styles.assignButtonText}>
                            Give to {p.playerName}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                </>
              ) : (
                <Text style={styles.modalSubtitle}>
                  Waiting for cards to be given...
                </Text>
              )}
              
              {/* Show who still needs to give cards */}
              {matchingPlayers.length > 0 && (
                <View style={styles.waitingSection}>
                  <Text style={styles.waitingLabel}>Still giving cards:</Text>
                  {matchingPlayers.map(id => {
                    const player = gameState.players.find(p => p.playerId === id);
                    const hand: Card[] = Array.isArray(player?.rtbHand) 
                      ? player.rtbHand 
                      : Object.values(player?.rtbHand || {}) as Card[];
                    const count = hand.filter(c => c && c.rank === flippedCard.rank).length;
                    return (
                      <Text key={id} style={styles.waitingPlayer}>
                        {player?.playerName}: {count} {RANK_DISPLAY[flippedCard.rank]}{count > 1 ? 's' : ''} left
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
        </View>
      </ScrollView>
    );
  }

  // RIDING PHASE UI
  if (rtb.phase === 'riding') {
    const rider = gameState.players.find(p => p.playerId === rtb.riderId);
    const isRider = rtb.riderId === currentPlayerId;
    const currentRound = rtb.riderRound || 0;
    const riderCards = Array.isArray(rtb.riderCards) ? rtb.riderCards : Object.values(rtb.riderCards || {});
    
    const roundNames = ['Red or Black', 'Higher or Lower', 'In-Between or Outside', 'Guess the Suit'];
    
    // The current card to guess on (if dealt)
    const currentCard = riderCards[currentRound];
    const hasCardToGuess = currentCard !== null && currentCard !== undefined;
    const cardRevealed = rtb.riderCardRevealed || false;
    
    console.log('Riding phase:', { currentRound, riderCards, hasCardToGuess, cardRevealed, isRider });
    
    return (
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.container}>
          <Text style={styles.title}>🚌 {rider?.playerName} is Riding!</Text>
          <Text style={styles.phase}>
            Round {currentRound + 1} of 4: {roundNames[currentRound]}
          </Text>
          
          {/* Show all player hands */}
          {renderPlayerHands()}

          {/* Rider's progress cards */}
          <View style={styles.riderSection}>
            <Text style={styles.sectionLabel}>Rider's Cards</Text>
            <View style={styles.riderCards}>
              {[0, 1, 2, 3].map((idx) => {
                const card = riderCards[idx];
                const isCurrentRound = idx === currentRound;
                const isPastRound = idx < currentRound;
                // Past rounds always revealed, current round only if cardRevealed is true
                const shouldReveal = isPastRound || (isCurrentRound && cardRevealed);
                return (
                  <View key={idx} style={styles.riderCardSlot}>
                    <PlayingCard
                      card={card as Card}
                      revealed={shouldReveal && card !== null && card !== undefined}
                      size="medium"
                      highlight={isCurrentRound}
                    />
                    <Text style={[
                      styles.riderCardLabel,
                      isPastRound && styles.riderCardLabelSuccess
                    ]}>
                      {isPastRound ? '✓' : isCurrentRound ? '?' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Guess buttons for rider - only show when card is face-down */}
          {isRider && hasCardToGuess && !cardRevealed && (
            <View style={styles.guessArea}>
              <Text style={styles.guessPrompt}>Make your guess:</Text>
              
              {currentRound === 0 && (
                <View style={styles.guessRow}>
                  <Pressable 
                    style={[styles.guessButton, styles.redButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('red')}
                    disabled={isGuessing}
                  >
                    <Text style={styles.guessButtonText}>♥♦ Red</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.guessButton, styles.blackButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('black')}
                    disabled={isGuessing}
                  >
                    <Text style={styles.guessButtonText}>♠♣ Black</Text>
                  </Pressable>
                </View>
              )}
              
              {currentRound === 1 && (
                <View style={styles.guessRow}>
                  <Pressable 
                    style={[styles.guessButton, styles.higherButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('higher')}
                    disabled={isGuessing}
                  >
                    <Text style={styles.guessButtonText}>📈 Higher</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.guessButton, styles.lowerButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('lower')}
                    disabled={isGuessing}
                  >
                    <Text style={styles.guessButtonText}>📉 Lower</Text>
                  </Pressable>
                </View>
              )}
              
              {currentRound === 2 && (
                <View style={styles.guessRow}>
                  <Pressable 
                    style={[styles.guessButton, styles.betweenButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('in-between')}
                    disabled={isGuessing}
                  >
                    <Text style={styles.guessButtonText}>↔️ In-Between</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.guessButton, styles.outsideButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('outside')}
                    disabled={isGuessing}
                  >
                    <Text style={styles.guessButtonText}>↕️ Outside</Text>
                  </Pressable>
                </View>
              )}
              
              {currentRound === 3 && (
                <View style={styles.suitRow}>
                  <Pressable 
                    style={[styles.suitButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('hearts')}
                    disabled={isGuessing}
                  >
                    <Text style={[styles.suitText, styles.redSuit]}>♥</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.suitButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('diamonds')}
                    disabled={isGuessing}
                  >
                    <Text style={[styles.suitText, styles.redSuit]}>♦</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.suitButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('clubs')}
                    disabled={isGuessing}
                  >
                    <Text style={[styles.suitText, styles.blackSuit]}>♣</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.suitButton, isGuessing && styles.buttonDisabled]} 
                    onPress={() => handleRiderGuess('spades')}
                    disabled={isGuessing}
                  >
                    <Text style={[styles.suitText, styles.blackSuit]}>♠</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Result display and Continue button - show when card is revealed */}
          {cardRevealed && rtb.riderLastGuess && (
            <View style={styles.resultArea}>
              <Text style={[
                styles.resultText,
                rtb.riderLastGuess.correct ? styles.resultCorrect : styles.resultWrong
              ]}>
                {rtb.riderLastGuess.correct ? '✓ Correct!' : '✗ Wrong!'}
              </Text>
              {!rtb.riderLastGuess.correct && (
                <Text style={styles.resultSubtext}>Take a drink and start over!</Text>
              )}
              {rtb.riderLastGuess.correct && currentRound < 3 && (
                <Text style={styles.resultSubtext}>Moving to next round...</Text>
              )}
              {isRider && (
                <Pressable 
                  style={[
                    styles.continueButton,
                    rtb.riderLastGuess.correct ? styles.continueButtonCorrect : styles.continueButtonWrong
                  ]}
                  onPress={handleContinueRiding}
                >
                  <Text style={styles.continueButtonText}>
                    {rtb.riderLastGuess.correct ? 'Next Card →' : 'Try Again'}
                  </Text>
                </Pressable>
              )}
              {!isRider && (
                <Text style={styles.waitingText}>
                  Waiting for {rider?.playerName} to continue...
                </Text>
              )}
            </View>
          )}

          {isRider && !hasCardToGuess && !cardRevealed && (
            <View style={styles.waitingArea}>
              <Text style={styles.waitingText}>Waiting for card to be dealt...</Text>
            </View>
          )}

          {!isRider && (
            <View style={styles.watchingArea}>
              <Text style={styles.watchingText}>
                👀 Watching {rider?.playerName} try to escape...
              </Text>
              <Text style={styles.watchingSubtext}>
                They need to get all 4 correct in a row!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // COMPLETE
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎉 Ride Complete!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  playerHandsSection: {
    width: '100%',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b8b9e',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playerHandCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  playerHandName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  playerHandNameYou: {
    color: '#4ade80',
  },
  playerHandCards: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  playerHandCardLeading: {
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#1a1a3e',
  },
  noCardsText: {
    fontSize: 12,
    color: '#4ade80',
    fontStyle: 'italic',
    padding: 8,
  },
  cardCountText: {
    fontSize: 12,
    color: '#8b8b9e',
    marginTop: 4,
  },
  cardCountLeading: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  matchingPlayersText: {
    fontSize: 12,
    color: '#8b8b9e',
    marginTop: 12,
    textAlign: 'center',
  },
  waitingSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  waitingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 8,
  },
  waitingPlayer: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 4,
  },
  doneButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 16,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  riderSection: {
    width: '100%',
    marginBottom: 16,
  },
  guessPrompt: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  riderCardLabelSuccess: {
    color: '#22c55e',
  },
  waitingArea: {
    padding: 20,
    alignItems: 'center',
  },
  resultArea: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    marginTop: 16,
  },
  resultText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultCorrect: {
    color: '#22c55e',
  },
  resultWrong: {
    color: '#ef4444',
  },
  resultSubtext: {
    fontSize: 16,
    color: '#8b8b9e',
    marginBottom: 16,
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 8,
  },
  continueButtonCorrect: {
    backgroundColor: '#22c55e',
  },
  continueButtonWrong: {
    backgroundColor: '#ef4444',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 8,
  },
  phase: {
    fontSize: 16,
    color: '#8b8b9e',
    marginBottom: 20,
  },
  rowsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  row: {
    marginBottom: 16,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cardSlot: {
    marginHorizontal: 4,
  },
  actionArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  flipButton: {
    backgroundColor: '#e94560',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  flipButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#4a4a6a',
  },
  flippedInfo: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 12,
  },
  flippedText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  matchingText: {
    fontSize: 14,
    color: '#8b8b9e',
    marginTop: 4,
  },
  drinkAckArea: {
    alignItems: 'center',
    marginTop: 12,
  },
  drinkText: {
    fontSize: 18,
    color: '#f59e0b',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  ackButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  ackButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scores: {
    width: '100%',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
  },
  scoresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b8b9e',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  scoreName: {
    fontSize: 14,
    color: '#ffffff',
  },
  scoreNameYou: {
    color: '#4ade80',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e94560',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8b8b9e',
    textAlign: 'center',
    marginBottom: 20,
  },
  assignButtons: {
    gap: 10,
  },
  assignButton: {
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  assignButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitingText: {
    fontSize: 14,
    color: '#8b8b9e',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Riding phase styles
  riderCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  riderCardSlot: {
    alignItems: 'center',
    marginHorizontal: 6,
  },
  riderCardLabel: {
    fontSize: 16,
    color: '#22c55e',
    marginTop: 4,
  },
  guessArea: {
    width: '100%',
    marginBottom: 20,
  },
  guessRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  guessButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
    maxWidth: 150,
  },
  guessButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  redButton: {
    backgroundColor: '#dc2626',
  },
  blackButton: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#3a3a5e',
  },
  higherButton: {
    backgroundColor: '#22c55e',
  },
  lowerButton: {
    backgroundColor: '#ef4444',
  },
  betweenButton: {
    backgroundColor: '#8b5cf6',
  },
  outsideButton: {
    backgroundColor: '#f59e0b',
  },
  suitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  suitButton: {
    width: 60,
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  suitText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  redSuit: {
    color: '#dc2626',
  },
  blackSuit: {
    color: '#1a1a2e',
  },
  watchingArea: {
    alignItems: 'center',
    padding: 20,
  },
  watchingText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 8,
  },
  watchingSubtext: {
    fontSize: 14,
    color: '#8b8b9e',
  },
});
