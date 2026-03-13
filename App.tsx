import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Player, Lobby, GameType, GameInfo, GameConfig, IrishPokerConfig, IrishPokerGameState, FishbowlConfig, FishbowlGameState, ShipCaptainCrewConfig, ShipCaptainCrewGameState, GolfConfig, GolfGameState, HorseRacesConfig, HorseRacesGameState } from './src/types';
import { getAccessPin } from './src/services/firebase';
import {
  createLobby,
  joinLobby,
  subscribeLobby,
  leaveLobby,
  cleanupGameAndLobby,
  initializeGame,
  subscribeToGame,
  submitGuess,
  assignDrinks,
  recordDrinksConsumed,
  flipRideTheBusCard,
  giveRideTheBusCard,
  finishGivingCards,
  acknowledgeDrinkAndAdvance,
  submitRiderGuess,
  continueRiding,
  replayGame,
  // Ship Captain Crew
  initializeShipCaptainCrew,
  subscribeToShipCaptainCrew,
  rollDice as sccRollDice,
  toggleDieLock as sccToggleDieLock,
  endTurn as sccEndTurn,
  replayShipCaptainCrew,
  // Fishbowl
  initializeFishbowl,
  subscribeToFishbowl,
  submitSlip,
  setPlayerReady,
  assignToTeam,
  autoAssignTeams,
  startFishbowlGame,
  startTurn,
  correctGuess,
  skipSlip,
  endTurn,
  endRound,
  continueToNextRound,
  replayFishbowl,
  // Golf
  initializeGolf,
  subscribeToGolf,
  flipInitialCard,
  drawCard as golfDrawCard,
  swapCard as golfSwapCard,
  discardDrawnCard as golfDiscardDrawn,
  startNextRound as golfStartNextRound,
  replayGolf,
  // Horse Races
  initializeHorseRaces,
  subscribeToHorseRaces,
  rollScratchDice,
  rollRaceDice,
  replayHorseRaces,
} from './src/services';
import { PlayerHand, GuessButtons, Scoreboard, DrinkAssigner, RideTheBus, Fishbowl, ShipCaptainCrew, Golf, HorseRaces } from './src/components';
import { ROUND_NAMES, RoundGuess } from './src/utils/cards';

type Screen = 'home' | 'host' | 'join' | 'lobby' | 'gameSelect' | 'irishPoker' | 'fishbowl' | 'shipCaptainCrew' | 'golf' | 'horseRaces';

const PIN_STORAGE_KEY = 'party-games-access';

// Available games list
const GAMES: GameInfo[] = [
  {
    id: 'irish-poker',
    name: 'Irish Poker',
    emoji: '🍀',
    description: 'Guess your cards right or drink! A classic drinking card game.',
    minPlayers: 2,
    maxPlayers: 10,
    available: true,
  },
  {
    id: 'fishbowl',
    name: 'Fishbowl',
    emoji: '🐟',
    description: 'Team word-guessing game with 4 rounds of increasing difficulty.',
    minPlayers: 4,
    maxPlayers: 20,
    available: true,
  },
  {
    id: 'ship-captain-crew',
    name: 'Ship Captain Crew',
    emoji: '🚢',
    description: 'Roll dice to find your Ship (6), Captain (5), and Crew (4) — then maximize your cargo! Lowest score drinks.',
    minPlayers: 2,
    maxPlayers: 10,
    available: true,
  },
  {
    id: 'golf',
    name: 'Golf',
    emoji: '⛳',
    description: 'Flip, swap, and match cards for the lowest score! Losers drink.',
    minPlayers: 2,
    maxPlayers: 6,
    available: true
  },
  {
    id: 'horse-races',
    name: 'Horse Races',
    emoji: '🏇',
    description: 'Bet on horses with cards, roll dice to race! Scratched horses mean penalties.',
    minPlayers: 2,
    maxPlayers: 10,
    available: true,
  },
];

export default function App() {
  const [hasAccess, setHasAccess] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [accessPin, setAccessPin] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(true);

  useEffect(() => {
    // Check session storage first
    if (Platform.OS === 'web') {
      try {
        if (sessionStorage.getItem(PIN_STORAGE_KEY) === 'granted') {
          setHasAccess(true);
        }
      } catch {}
    }
    // Fetch PIN from Remote Config
    getAccessPin().then((pin) => {
      setAccessPin(pin);
      setPinLoading(false);
    });
  }, []);

  const handlePinSubmit = () => {
    if (!accessPin) return; // PIN not loaded yet
    if (pinInput === accessPin) {
      setHasAccess(true);
      setPinError(false);
      if (Platform.OS === 'web') {
        try { sessionStorage.setItem(PIN_STORAGE_KEY, 'granted'); } catch {}
      }
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  if (!hasAccess) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <View style={styles.content}>
            <Text style={styles.title}>🔒</Text>
            <Text style={styles.subtitle}>Enter PIN to continue</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="PIN"
                placeholderTextColor="#8b8b9e"
                value={pinInput}
                onChangeText={(t) => { setPinInput(t); setPinError(false); }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                onSubmitEditing={handlePinSubmit}
              />
              {pinError && (
                <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12 }}>
                  Wrong PIN
                </Text>
              )}
              <Pressable
                style={[styles.button, (!pinInput || pinLoading) && styles.buttonDisabled]}
                onPress={handlePinSubmit}
                disabled={!pinInput || pinLoading}
              >
                <Text style={styles.buttonText}>Enter</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return <GameApp />;
}

function GameApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [lobbyCode, setLobbyCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Input states
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');

  // Game selection states
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [irishPokerConfig, setIrishPokerConfig] = useState<IrishPokerConfig>({
    includeRideTheBus: true,
  });
  const [fishbowlConfig, setFishbowlConfig] = useState<FishbowlConfig>({
    slipsPerPlayer: 3,
    turnTimeSeconds: 60,
  });
  const [sccConfig, setSccConfig] = useState<ShipCaptainCrewConfig>({
    maxRounds: 10,
  });

  // Game states
  const [gameState, setGameState] = useState<IrishPokerGameState | null>(null);
  const [fishbowlState, setFishbowlState] = useState<FishbowlGameState | null>(null);
  const [sccState, setSccState] = useState<ShipCaptainCrewGameState | null>(null);
  const [golfConfig, setGolfConfig] = useState<GolfConfig>({ variant: '6-card', totalRounds: 9 });
  const [golfState, setGolfState] = useState<GolfGameState | null>(null);
  const [horseRacesConfig, setHorseRacesConfig] = useState<HorseRacesConfig>({ startingChips: 10 });
  const [horseRacesState, setHorseRacesState] = useState<HorseRacesGameState | null>(null);
  const [showDrinkAssigner, setShowDrinkAssigner] = useState(false);
  const [drinksToAssign, setDrinksToAssign] = useState(0);
  const [lastGuessResult, setLastGuessResult] = useState<{ correct: boolean; message: string } | null>(null);

  const goHome = async (cleanup: boolean = false) => {
    // Clean up game/lobby data if requested (host exiting a game)
    if (cleanup && lobbyCode && isHost) {
      try {
        await cleanupGameAndLobby(lobbyCode);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    setScreen('home');
    setLobbyCode('');
    setPlayerName('');
    setPlayerId('');
    setIsHost(false);
    setLobby(null);
    setNameInput('');
    setCodeInput('');
    setSelectedGame(null);
    setIrishPokerConfig({ includeRideTheBus: true });
    setFishbowlConfig({ slipsPerPlayer: 3, turnTimeSeconds: 60 });
    setSccConfig({ maxRounds: 10 });
    setGolfConfig({ variant: '6-card', totalRounds: 9 });
    setGameState(null);
    setFishbowlState(null);
    setSccState(null);
    setGolfState(null);
    setShowDrinkAssigner(false);
    setDrinksToAssign(0);
    setLastGuessResult(null);
  };

  // Subscribe to lobby updates when in lobby or gameSelect screen
  useEffect(() => {
    if (!lobbyCode) return;
    // Keep subscription active for lobby and gameSelect screens
    if (screen !== 'lobby' && screen !== 'gameSelect') return;

    const unsubscribe = subscribeLobby(lobbyCode, (updatedLobby) => {
      if (updatedLobby === null) {
        Alert.alert('Lobby Closed', 'The host has closed the lobby.', [
          { text: 'OK', onPress: () => goHome() }
        ]);
        return;
      }
      setLobby(updatedLobby);
      
      // If game started, switch to game screen (for non-host players)
      if (updatedLobby.status === 'playing') {
        if (updatedLobby.gameType === 'irish-poker') {
          console.log('Game started, redirecting to irishPoker screen');
          setScreen('irishPoker');
        } else if (updatedLobby.gameType === 'fishbowl') {
          console.log('Game started, redirecting to fishbowl screen');
          setScreen('fishbowl');
        } else if (updatedLobby.gameType === 'ship-captain-crew') {
          console.log('Game started, redirecting to shipCaptainCrew screen');
          setScreen('shipCaptainCrew');
        } else if (updatedLobby.gameType === 'golf') {
          console.log('Game started, redirecting to golf screen');
          setScreen('golf');
        } else if (updatedLobby.gameType === 'horse-races') {
          console.log('Game started, redirecting to horse races screen');
          setScreen('horseRaces');
        }
      }
    });

    return () => unsubscribe();
  }, [screen, lobbyCode]);

  // Subscribe to Irish Poker game state updates
  useEffect(() => {
    if (screen !== 'irishPoker' || !lobbyCode) return;

    const unsubscribe = subscribeToGame(lobbyCode, (state) => {
      if (state === null) {
        Alert.alert('Game Ended', 'The game has ended.', [
          { text: 'OK', onPress: () => goHome() }
        ]);
        return;
      }
      setGameState(state);
    });

    return () => unsubscribe();
  }, [screen, lobbyCode]);

  // Subscribe to Fishbowl game state updates
  useEffect(() => {
    if (screen !== 'fishbowl' || !lobbyCode) return;

    const unsubscribe = subscribeToFishbowl(lobbyCode, (state) => {
      if (state === null) {
        Alert.alert('Game Ended', 'The game has ended.', [
          { text: 'OK', onPress: () => goHome() }
        ]);
        return;
      }
      setFishbowlState(state);
    });

    return () => unsubscribe();
  }, [screen, lobbyCode]);

  // Subscribe to Golf game state updates
  useEffect(() => {
    if (screen !== 'golf' || !lobbyCode) return;

    const unsubscribe = subscribeToGolf(lobbyCode, (state) => {
      if (state === null) {
        Alert.alert('Game Ended', 'The game has ended.', [
          { text: 'OK', onPress: () => goHome() }
        ]);
        return;
      }
      setGolfState(state);
    });

    return () => unsubscribe();
  }, [screen, lobbyCode]);

  // Subscribe to Ship Captain Crew game state updates
  useEffect(() => {
    if (screen !== 'shipCaptainCrew' || !lobbyCode) return;

    const unsubscribe = subscribeToShipCaptainCrew(lobbyCode, (state) => {
      if (state === null) {
        Alert.alert('Game Ended', 'The game has ended.', [
          { text: 'OK', onPress: () => goHome() }
        ]);
        return;
      }
      setSccState(state);
    });

    return () => unsubscribe();
  }, [screen, lobbyCode]);

  // Subscribe to Horse Races game state updates
  useEffect(() => {
    if (screen !== 'horseRaces' || !lobbyCode) return;

    const unsubscribe = subscribeToHorseRaces(lobbyCode, (state) => {
      if (state === null) {
        Alert.alert('Game Ended', 'The game has ended.', [
          { text: 'OK', onPress: () => goHome() }
        ]);
        return;
      }
      setHorseRacesState(state);
    });

    return () => unsubscribe();
  }, [screen, lobbyCode]);

  const handleCreateLobby = async () => {
    if (!nameInput.trim()) return;
    setIsLoading(true);
    try {
      const result = await createLobby(nameInput.trim());
      setLobbyCode(result.lobbyCode);
      setPlayerId(result.playerId);
      setPlayerName(nameInput.trim());
      setIsHost(true);
      setScreen('lobby');
    } catch (error) {
      Alert.alert('Error', 'Could not create lobby. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!nameInput.trim() || !codeInput.trim()) return;
    setIsLoading(true);
    try {
      const code = codeInput.toUpperCase().trim();
      const result = await joinLobby(code, nameInput.trim());
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Could not join lobby');
        return;
      }

      setLobbyCode(code);
      setPlayerId(result.playerId!);
      setPlayerName(nameInput.trim());
      setIsHost(false);
      setScreen('lobby');
    } catch (error) {
      Alert.alert('Error', 'Could not join lobby. Please check the code.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveLobby = async () => {
    try {
      await leaveLobby(lobbyCode, playerId);
    } catch (error) {
      console.error(error);
    }
    goHome();
  };

  // HOME SCREEN
  if (screen === 'home') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <View style={styles.content}>
            <Text style={styles.title}>🎉 Party Games</Text>
            <Text style={styles.subtitle}>Get the party started!</Text>
            
            <View style={styles.buttonContainer}>
              <Pressable style={styles.button} onPress={() => setScreen('host')}>
                <Text style={styles.buttonText}>Host a Lobby</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.button, styles.secondaryButton]} 
                onPress={() => setScreen('join')}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  Join a Lobby
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // HOST SCREEN
  if (screen === 'host') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.content}
          >
            <Text style={styles.screenTitle}>Host a Lobby</Text>
            <Text style={styles.subtitle}>Enter your name to create a game</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#8b8b9e"
                value={nameInput}
                onChangeText={setNameInput}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={20}
              />

              <Pressable
                style={[styles.button, !nameInput.trim() && styles.buttonDisabled]}
                onPress={handleCreateLobby}
                disabled={!nameInput.trim() || isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Creating...' : 'Create Lobby'}
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.backButton} onPress={() => goHome()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // JOIN SCREEN
  if (screen === 'join') {
    const isFormValid = nameInput.trim() && codeInput.trim().length >= 4;
    
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.content}
          >
            <Text style={styles.screenTitle}>Join a Lobby</Text>
            <Text style={styles.subtitle}>Enter your name and lobby code</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#8b8b9e"
                value={nameInput}
                onChangeText={setNameInput}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={20}
              />

              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="CODE"
                placeholderTextColor="#8b8b9e"
                value={codeInput}
                onChangeText={(text) => setCodeInput(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={5}
              />

              <Pressable
                style={[styles.button, !isFormValid && styles.buttonDisabled]}
                onPress={handleJoinLobby}
                disabled={!isFormValid || isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Joining...' : 'Join Lobby'}
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.backButton} onPress={() => goHome()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // GAME SELECT SCREEN
  if (screen === 'gameSelect') {
    const players = lobby?.players || [];
    
    const handleStartGame = async () => {
      if (!selectedGame || !lobbyCode) return;
      
      setIsLoading(true);
      try {
        if (selectedGame === 'irish-poker') {
          await initializeGame(lobbyCode, irishPokerConfig);
          setScreen('irishPoker');
        } else if (selectedGame === 'fishbowl') {
          await initializeFishbowl(lobbyCode, fishbowlConfig);
          setScreen('fishbowl');
        } else if (selectedGame === 'ship-captain-crew') {
          await initializeShipCaptainCrew(lobbyCode, sccConfig);
          setScreen('shipCaptainCrew');
        } else if (selectedGame === 'golf') {
          await initializeGolf(lobbyCode, golfConfig);
          setScreen('golf');
        } else if (selectedGame === 'horse-races') {
          await initializeHorseRaces(lobbyCode, horseRacesConfig);
          setScreen('horseRaces');
        }
      } catch (error) {
        console.error('Failed to start game:', error);
        Alert.alert('Error', 'Failed to start game. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          
          <View style={styles.gameSelectHeader}>
            <Pressable style={styles.backButton} onPress={() => setScreen('lobby')}>
              <Text style={styles.backButtonText}>← Back to Lobby</Text>
            </Pressable>
            <Text style={styles.screenTitle}>Choose a Game</Text>
            <Text style={styles.subtitle}>{players.length} players ready</Text>
          </View>

          <FlatList
            data={GAMES}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.gamesList}
            renderItem={({ item }) => {
              const isSelected = selectedGame === item.id;
              const playerCountOk = players.length >= item.minPlayers && players.length <= item.maxPlayers;
              const canSelect = item.available && playerCountOk;
              
              return (
                <Pressable
                  style={[
                    styles.gameCard,
                    isSelected && styles.gameCardSelected,
                    !canSelect && styles.gameCardDisabled,
                  ]}
                  onPress={() => canSelect && setSelectedGame(item.id)}
                  disabled={!canSelect}
                >
                  <View style={styles.gameCardHeader}>
                    <Text style={styles.gameEmoji}>{item.emoji}</Text>
                    <View style={styles.gameCardTitleRow}>
                      <Text style={[styles.gameName, !canSelect && styles.gameNameDisabled]}>
                        {item.name}
                      </Text>
                      {!item.available && (
                        <View style={styles.comingSoonBadge}>
                          <Text style={styles.comingSoonText}>Coming Soon</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.gameDescription, !canSelect && styles.gameDescriptionDisabled]}>
                    {item.description}
                  </Text>
                  <Text style={styles.playerCount}>
                    {item.minPlayers}-{item.maxPlayers} players
                  </Text>
                  
                  {/* Irish Poker Options */}
                  {isSelected && item.id === 'irish-poker' && (
                    <View style={styles.gameOptions}>
                      <Pressable
                        style={styles.optionRow}
                        onPress={() => setIrishPokerConfig(prev => ({
                          ...prev,
                          includeRideTheBus: !prev.includeRideTheBus,
                        }))}
                      >
                        <View style={styles.optionInfo}>
                          <Text style={styles.optionLabel}>🚌 Ride the Bus</Text>
                          <Text style={styles.optionDescription}>
                            Loser plays bonus round at the end
                          </Text>
                        </View>
                        <View style={[
                          styles.toggle,
                          irishPokerConfig.includeRideTheBus && styles.toggleOn,
                        ]}>
                          <View style={[
                            styles.toggleKnob,
                            irishPokerConfig.includeRideTheBus && styles.toggleKnobOn,
                          ]} />
                        </View>
                      </Pressable>
                    </View>
                  )}
                  
                  {/* Fishbowl Options */}
                  {isSelected && item.id === 'fishbowl' && (
                    <View style={styles.gameOptions}>
                      <View style={styles.optionRow}>
                        <View style={styles.optionInfo}>
                          <Text style={styles.optionLabel}>📝 Clues per Player</Text>
                          <Text style={styles.optionDescription}>
                            How many slips each person writes
                          </Text>
                        </View>
                        <View style={styles.numberPicker}>
                          <Pressable 
                            style={styles.numberButton}
                            onPress={() => setFishbowlConfig(prev => ({
                              ...prev,
                              slipsPerPlayer: Math.max(2, prev.slipsPerPlayer - 1),
                            }))}
                          >
                            <Text style={styles.numberButtonText}>-</Text>
                          </Pressable>
                          <Text style={styles.numberValue}>{fishbowlConfig.slipsPerPlayer}</Text>
                          <Pressable 
                            style={styles.numberButton}
                            onPress={() => setFishbowlConfig(prev => ({
                              ...prev,
                              slipsPerPlayer: Math.min(5, prev.slipsPerPlayer + 1),
                            }))}
                          >
                            <Text style={styles.numberButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.optionRow}>
                        <View style={styles.optionInfo}>
                          <Text style={styles.optionLabel}>⏱️ Turn Time</Text>
                          <Text style={styles.optionDescription}>
                            Seconds per turn
                          </Text>
                        </View>
                        <View style={styles.numberPicker}>
                          <Pressable 
                            style={styles.numberButton}
                            onPress={() => setFishbowlConfig(prev => ({
                              ...prev,
                              turnTimeSeconds: Math.max(30, prev.turnTimeSeconds - 15),
                            }))}
                          >
                            <Text style={styles.numberButtonText}>-</Text>
                          </Pressable>
                          <Text style={styles.numberValue}>{fishbowlConfig.turnTimeSeconds}s</Text>
                          <Pressable 
                            style={styles.numberButton}
                            onPress={() => setFishbowlConfig(prev => ({
                              ...prev,
                              turnTimeSeconds: Math.min(120, prev.turnTimeSeconds + 15),
                            }))}
                          >
                            <Text style={styles.numberButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  )}
                  {isSelected && item.id === 'horse-races' && (
                    <View style={styles.configSection}>
                      <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Starting Chips</Text>
                        <View style={styles.numberControl}>
                          <Pressable style={styles.numberButton} onPress={() => setHorseRacesConfig(prev => ({ ...prev, startingChips: Math.max(5, prev.startingChips - 5) }))}>
                            <Text style={styles.numberButtonText}>-</Text>
                          </Pressable>
                          <Text style={styles.numberValue}>{horseRacesConfig.startingChips}</Text>
                          <Pressable style={styles.numberButton} onPress={() => setHorseRacesConfig(prev => ({ ...prev, startingChips: Math.min(50, prev.startingChips + 5) }))}>
                            <Text style={styles.numberButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  )}
                  {isSelected && item.id === 'golf' && (
                    <View style={styles.configSection}>
                      <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Variant</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {(['4-card', '6-card', '9-card'] as const).map(v => (
                            <Pressable
                              key={v}
                              style={[styles.numberButton, golfConfig.variant === v && { backgroundColor: '#e94560' }]}
                              onPress={() => setGolfConfig(prev => ({ ...prev, variant: v }))}
                            >
                              <Text style={[styles.numberButtonText, golfConfig.variant === v && { color: '#fff' }]}>{v}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      <View style={styles.configRow}>
                        <Text style={styles.configLabel}>Rounds</Text>
                        <View style={styles.numberControl}>
                          <Pressable style={styles.numberButton} onPress={() => setGolfConfig(prev => ({ ...prev, totalRounds: Math.max(1, prev.totalRounds - 1) }))}>
                            <Text style={styles.numberButtonText}>-</Text>
                          </Pressable>
                          <Text style={styles.numberValue}>{golfConfig.totalRounds}</Text>
                          <Pressable style={styles.numberButton} onPress={() => setGolfConfig(prev => ({ ...prev, totalRounds: Math.min(18, prev.totalRounds + 1) }))}>
                            <Text style={styles.numberButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            }}
          />

          <View style={styles.footer}>
            <Pressable
              style={[styles.button, !selectedGame && styles.buttonDisabled]}
              disabled={!selectedGame}
              onPress={handleStartGame}
            >
              <Text style={styles.buttonText}>
                {selectedGame 
                  ? `Start ${GAMES.find(g => g.id === selectedGame)?.name}` 
                  : 'Select a Game'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // IRISH POKER GAME SCREEN
  if (screen === 'irishPoker' && gameState) {
    const currentTurnPlayerId = gameState.turnOrder[gameState.currentPlayerIndex];
    const isMyTurn = currentTurnPlayerId === playerId;
    const myPlayer = gameState.players.find(p => p.playerId === playerId);
    const currentPlayer = gameState.players.find(p => p.playerId === currentTurnPlayerId);

    const handleGuess = async (guess: string) => {
      if (!isMyTurn) return;

      try {
        const result = await submitGuess(lobbyCode, playerId, guess as RoundGuess);
        
        if (result.correct) {
          setLastGuessResult({ correct: true, message: `Correct! Give out ${result.drinksToAssign} drinks!` });
          if (result.drinksToAssign > 0) {
            setDrinksToAssign(result.drinksToAssign);
            setShowDrinkAssigner(true);
          }
        } else {
          setLastGuessResult({ correct: false, message: `Wrong! Drink ${result.drinksToTake}!` });
        }

        // Clear result after delay
        setTimeout(() => setLastGuessResult(null), 3000);
      } catch (error) {
        console.error('Failed to submit guess:', error);
        Alert.alert('Error', 'Failed to submit guess. Please try again.');
      }
    };

    const handleAssignDrinks = async (toPlayerId: string, amount: number) => {
      try {
        await assignDrinks(lobbyCode, playerId, toPlayerId, amount);
      } catch (error) {
        console.error('Failed to assign drinks:', error);
      }
    };

    const handleRecordDrink = async () => {
      try {
        await recordDrinksConsumed(lobbyCode, playerId, 1);
      } catch (error) {
        console.error('Failed to record drink:', error);
      }
    };

    // Sort players: current turn first, then others
    const sortedPlayers = [...gameState.players].sort((a, b) => {
      if (a.playerId === currentTurnPlayerId) return -1;
      if (b.playerId === currentTurnPlayerId) return 1;
      if (a.playerId === playerId) return -1;
      if (b.playerId === playerId) return 1;
      return 0;
    });

    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />

          {/* Header */}
          <View style={styles.gameHeader}>
            <Text style={styles.roundIndicator}>
              Round {gameState.currentRound + 1} of 4
            </Text>
            <Text style={styles.roundName}>
              {ROUND_NAMES[gameState.roundType]}
            </Text>
            <Text style={styles.turnIndicator}>
              {isMyTurn ? "🎯 Your Turn!" : `${currentPlayer?.playerName}'s turn`}
            </Text>
          </View>

          {/* Result Flash */}
          {lastGuessResult && (
            <View style={[
              styles.resultFlash,
              lastGuessResult.correct ? styles.resultCorrect : styles.resultWrong,
            ]}>
              <Text style={styles.resultText}>{lastGuessResult.message}</Text>
            </View>
          )}

          {/* Players' Hands */}
          <ScrollView style={styles.handsContainer}>
            {sortedPlayers.map(player => (
              <PlayerHand
                key={player.playerId}
                player={player}
                currentRound={gameState.currentRound}
                isCurrentTurn={player.playerId === currentTurnPlayerId}
                isYou={player.playerId === playerId}
                compact={gameState.players.length > 4}
              />
            ))}
          </ScrollView>

          {/* Guess Buttons (only for current player) */}
          {isMyTurn && gameState.phase === 'main' && (
            <GuessButtons
              roundType={gameState.roundType}
              roundIndex={gameState.currentRound}
              onGuess={handleGuess}
            />
          )}

          {/* Scoreboard Toggle */}
          <View style={styles.gameFooter}>
            <Scoreboard
              players={gameState.players}
              currentPlayerId={playerId}
              onRecordDrink={handleRecordDrink}
            />
          </View>

          {/* Drink Assigner Modal */}
          <DrinkAssigner
            visible={showDrinkAssigner}
            drinksToAssign={drinksToAssign}
            players={gameState.players}
            currentPlayerId={playerId}
            onAssign={handleAssignDrinks}
            onClose={() => {
              setShowDrinkAssigner(false);
              setDrinksToAssign(0);
            }}
          />

          {/* Ride the Bus Phase */}
          {gameState.phase === 'ride-the-bus' && gameState.rideTheBus && (
            <View style={styles.rideTheBusOverlay}>
              <RideTheBus
                gameState={gameState}
                currentPlayerId={playerId}
                isHost={isHost}
                onFlipCard={async () => {
                  await flipRideTheBusCard(lobbyCode);
                }}
                onGiveCard={async (toPlayerId: string) => {
                  const flippedCard = gameState.rideTheBus?.currentFlipCard;
                  if (!flippedCard) throw new Error('No card flipped');
                  return await giveRideTheBusCard(lobbyCode, playerId, toPlayerId, flippedCard.rank);
                }}
                onFinishGiving={async () => {
                  await finishGivingCards(lobbyCode);
                }}
                onAcknowledgeDrink={async () => {
                  await acknowledgeDrinkAndAdvance(lobbyCode);
                }}
                onRiderGuess={async (guess: string) => {
                  const result = await submitRiderGuess(lobbyCode, guess as any);
                  if (result.escaped) {
                    Alert.alert('🎉 ESCAPED!', 'You made it off the bus!');
                  }
                  return result;
                }}
                onContinueRiding={async () => {
                  await continueRiding(lobbyCode);
                }}
              />
              <Pressable 
                style={styles.exitButton} 
                onPress={() => {
                  Alert.alert(
                    'Exit Game',
                    isHost 
                      ? 'This will end the game for everyone. Are you sure?' 
                      : 'Are you sure you want to leave?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Exit', style: 'destructive', onPress: () => goHome(isHost) }
                    ]
                  );
                }}
              >
                <Text style={styles.exitButtonText}>Exit Game</Text>
              </Pressable>
            </View>
          )}

          {/* Game Complete */}
          {gameState.phase === 'complete' && (
            <View style={styles.gameCompleteOverlay}>
              <View style={styles.gameCompleteModal}>
                <Text style={styles.gameCompleteTitle}>🎉 Game Complete!</Text>
                {gameState.rideTheBus?.riderId && (
                  <Text style={styles.gameCompleteSubtitle}>
                    {gameState.players.find(p => p.playerId === gameState.rideTheBus?.riderId)?.playerName} escaped the bus!
                  </Text>
                )}
                <Pressable 
                  style={[styles.button, styles.replayButton]} 
                  onPress={async () => {
                    try {
                      await replayGame(lobbyCode);
                    } catch (error) {
                      console.error('Replay error:', error);
                      Alert.alert('Error', 'Failed to replay game');
                    }
                  }}
                >
                  <Text style={styles.buttonText}>🔄 Play Again</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.homeButton]} onPress={() => goHome(true)}>
                  <Text style={styles.buttonText}>Exit to Home</Text>
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // FISHBOWL GAME SCREEN
  if (screen === 'fishbowl' && fishbowlState) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <Fishbowl
            gameState={fishbowlState}
            currentPlayerId={playerId}
            isHost={isHost}
            onSubmitSlip={async (text) => {
              await submitSlip(lobbyCode, playerId, text);
            }}
            onSetReady={async (ready) => {
              await setPlayerReady(lobbyCode, playerId, ready);
            }}
            onAssignTeam={async (targetPlayerId, teamId) => {
              await assignToTeam(lobbyCode, targetPlayerId, teamId);
            }}
            onAutoAssignTeams={async () => {
              await autoAssignTeams(lobbyCode);
            }}
            onStartGame={async () => {
              await startFishbowlGame(lobbyCode);
            }}
            onStartTurn={async () => {
              await startTurn(lobbyCode);
            }}
            onCorrectGuess={async () => {
              return await correctGuess(lobbyCode);
            }}
            onSkipSlip={async () => {
              await skipSlip(lobbyCode);
            }}
            onEndTurn={async () => {
              await endTurn(lobbyCode);
            }}
            onEndRound={async () => {
              return await endRound(lobbyCode);
            }}
            onContinueToNextRound={async () => {
              await continueToNextRound(lobbyCode);
            }}
            onReplay={async () => {
              await replayFishbowl(lobbyCode);
            }}
            onExit={() => goHome(isHost)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // SHIP CAPTAIN CREW GAME SCREEN
  if (screen === 'shipCaptainCrew' && sccState) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <ShipCaptainCrew
            gameState={sccState}
            currentPlayerId={playerId}
            isHost={isHost}
            onRollDice={async () => {
              await sccRollDice(lobbyCode, playerId);
            }}
            onToggleDieLock={async (dieIndex) => {
              await sccToggleDieLock(lobbyCode, playerId, dieIndex);
            }}
            onEndTurn={async () => {
              await sccEndTurn(lobbyCode, playerId);
            }}
            onReplay={async () => {
              await replayShipCaptainCrew(lobbyCode);
            }}
            onExit={() => goHome(isHost)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // GOLF GAME SCREEN
  if (screen === 'golf' && golfState) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <Golf
            gameState={golfState}
            currentPlayerId={playerId}
            isHost={isHost}
            onFlipInitial={async (cardIndex) => {
              await flipInitialCard(lobbyCode, playerId, cardIndex);
            }}
            onDrawCard={async (source) => {
              await golfDrawCard(lobbyCode, playerId, source);
            }}
            onSwapCard={async (cardIndex) => {
              await golfSwapCard(lobbyCode, playerId, cardIndex);
            }}
            onDiscardDrawn={async (flipIndex) => {
              await golfDiscardDrawn(lobbyCode, playerId, flipIndex);
            }}
            onStartNextRound={async () => {
              await golfStartNextRound(lobbyCode);
            }}
            onReplay={async () => {
              await replayGolf(lobbyCode);
            }}
            onExit={() => goHome(isHost)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // HORSE RACES GAME SCREEN
  if (screen === 'horseRaces' && horseRacesState) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <HorseRaces
            gameState={horseRacesState}
            currentPlayerId={playerId}
            isHost={isHost}
            onRollScratch={async () => {
              await rollScratchDice(lobbyCode, playerId);
            }}
            onRollRace={async () => {
              await rollRaceDice(lobbyCode, playerId);
            }}
            onReplay={async () => {
              await replayHorseRaces(lobbyCode);
            }}
            onExit={() => goHome(isHost)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // LOBBY SCREEN
  const players = lobby?.players || [];

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={styles.playerCard}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {item.name}
          {item.id === playerId && ' (You)'}
        </Text>
        {item.isHost && <Text style={styles.hostBadge}>HOST</Text>}
      </View>
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Lobby</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Share this code:</Text>
            <Text style={styles.code}>{lobbyCode}</Text>
          </View>
        </View>

        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>Players ({players.length})</Text>
          <FlatList
            data={players}
            renderItem={renderPlayer}
            keyExtractor={(item) => item.id}
            style={styles.playersList}
          />
        </View>

        <View style={styles.footer}>
          {isHost ? (
            <Pressable
              style={[styles.button, players.length < 2 && styles.buttonDisabled]}
              disabled={players.length < 2}
              onPress={() => setScreen('gameSelect')}
            >
              <Text style={styles.buttonText}>
                {players.length < 2 ? 'Waiting for players...' : 'Choose Game'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.waitingContainer}>
              <Text style={styles.waitingText}>
                Waiting for host to start...
              </Text>
            </View>
          )}

          <Pressable style={styles.leaveButton} onPress={handleLeaveLobby}>
            <Text style={styles.leaveButtonText}>Leave Lobby</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#8b8b9e',
    marginBottom: 60,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 300,
  },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 18,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    marginBottom: 16,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#e94560',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#4a4a6a',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#e94560',
  },
  secondaryButtonText: {
    color: '#e94560',
  },
  backButton: {
    marginTop: 30,
  },
  backButtonText: {
    color: '#8b8b9e',
    fontSize: 16,
  },
  // Lobby styles
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  codeContainer: {
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 14,
    color: '#8b8b9e',
    marginBottom: 8,
  },
  code: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#e94560',
    letterSpacing: 8,
  },
  playersSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  playersList: {
    flex: 1,
  },
  playerCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '500',
    marginRight: 12,
  },
  hostBadge: {
    fontSize: 12,
    color: '#e94560',
    fontWeight: 'bold',
    backgroundColor: '#2a1a2e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  waitingContainer: {
    backgroundColor: '#16213e',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  waitingText: {
    color: '#8b8b9e',
    fontSize: 16,
  },
  leaveButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#8b8b9e',
    fontSize: 16,
  },
  // Game Select styles
  gameSelectHeader: {
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  gamesList: {
    padding: 20,
  },
  gameCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gameCardSelected: {
    borderColor: '#e94560',
    backgroundColor: '#1a1a3e',
  },
  gameCardDisabled: {
    opacity: 0.5,
  },
  gameCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  gameCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gameName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  gameNameDisabled: {
    color: '#8b8b9e',
  },
  comingSoonBadge: {
    backgroundColor: '#2a2a4a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 10,
  },
  comingSoonText: {
    color: '#8b8b9e',
    fontSize: 12,
    fontWeight: '600',
  },
  gameDescription: {
    fontSize: 15,
    color: '#b8b8c8',
    marginBottom: 8,
    lineHeight: 20,
  },
  gameDescriptionDisabled: {
    color: '#6b6b7e',
  },
  playerCount: {
    fontSize: 13,
    color: '#8b8b9e',
  },
  gameOptions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionInfo: {
    flex: 1,
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#8b8b9e',
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a4a',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#e94560',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  numberPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  numberValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  // Irish Poker Game styles
  gameHeader: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  roundIndicator: {
    fontSize: 14,
    color: '#8b8b9e',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  roundName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  turnIndicator: {
    fontSize: 16,
    color: '#e94560',
    marginTop: 8,
    fontWeight: '600',
  },
  resultFlash: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultCorrect: {
    backgroundColor: '#22c55e',
  },
  resultWrong: {
    backgroundColor: '#ef4444',
  },
  resultText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  handsContainer: {
    flex: 1,
    padding: 16,
  },
  gameFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    maxHeight: 280,
  },
  gameCompleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameCompleteModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  gameCompleteTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  gameCompleteSubtitle: {
    fontSize: 16,
    color: '#22c55e',
    marginBottom: 24,
  },
  replayButton: {
    backgroundColor: '#22c55e',
    marginBottom: 12,
    width: '100%',
  },
  homeButton: {
    backgroundColor: '#6b7280',
    width: '100%',
  },
  // Ride the Bus styles
  rideTheBusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  rideTheBusModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  rideTheBusTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 16,
  },
  rtbContent: {
    width: '100%',
    alignItems: 'center',
  },
  rtbSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  rtbDescription: {
    fontSize: 14,
    color: '#8b8b9e',
    textAlign: 'center',
    marginBottom: 16,
  },
  rtbScores: {
    width: '100%',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  rtbScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  rtbPlayerName: {
    fontSize: 14,
    color: '#ffffff',
  },
  rtbCardCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e94560',
  },
  rtbNote: {
    fontSize: 12,
    color: '#6b6b7e',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  exitButton: {
    position: 'absolute',
    bottom: 40,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  exitButtonText: {
    color: '#8b8b9e',
    fontSize: 16,
  },
});
