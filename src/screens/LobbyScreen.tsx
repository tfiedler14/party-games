import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, Player, Lobby } from '../types';
import { subscribeLobby, leaveLobby } from '../services';

type LobbyScreenProps = StackScreenProps<RootStackParamList, 'Lobby'>;

export default function LobbyScreen({ route, navigation }: LobbyScreenProps) {
  const { lobbyCode, playerName, isHost, playerId } = route.params;
  const [lobby, setLobby] = useState<Lobby | null>(null);

  useEffect(() => {
    // Subscribe to real-time lobby updates
    const unsubscribe = subscribeLobby(lobbyCode, (updatedLobby) => {
      if (updatedLobby === null) {
        // Lobby was deleted (host left)
        Alert.alert('Lobby Closed', 'The host has closed the lobby.', [
          { text: 'OK', onPress: () => navigation.popToTop() }
        ]);
        return;
      }
      setLobby(updatedLobby);
    });

    return () => {
      unsubscribe();
    };
  }, [lobbyCode, navigation]);

  const handleStartGame = () => {
    // TODO: Implement game selection and start
    console.log('Starting game...');
  };

  const handleLeaveLobby = async () => {
    try {
      await leaveLobby(lobbyCode, playerId);
      navigation.popToTop();
    } catch (error) {
      console.error('Error leaving lobby:', error);
      navigation.popToTop();
    }
  };

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lobby</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Share this code:</Text>
          <Text style={styles.code}>{lobbyCode}</Text>
        </View>
      </View>

      <View style={styles.playersSection}>
        <Text style={styles.sectionTitle}>
          Players ({players.length})
        </Text>
        <FlatList
          data={players}
          renderItem={renderPlayer}
          keyExtractor={(item) => item.id}
          style={styles.playersList}
          contentContainerStyle={styles.playersListContent}
        />
      </View>

      <View style={styles.footer}>
        {isHost ? (
          <TouchableOpacity
            style={[styles.button, players.length < 2 && styles.buttonDisabled]}
            onPress={handleStartGame}
            disabled={players.length < 2}
          >
            <Text style={styles.buttonText}>
              {players.length < 2 ? 'Waiting for players...' : 'Choose Game'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>
              Waiting for host to start the game...
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleLeaveLobby}
        >
          <Text style={styles.leaveButtonText}>Leave Lobby</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
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
  playersListContent: {
    paddingBottom: 12,
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
    gap: 12,
  },
  playerName: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '500',
  },
  hostBadge: {
    fontSize: 12,
    color: '#e94560',
    fontWeight: 'bold',
    backgroundColor: '#2a1a2e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  button: {
    backgroundColor: '#e94560',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#4a4a6a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
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
});
