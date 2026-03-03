import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { joinLobby } from '../services';

type JoinLobbyScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'JoinLobby'>;
};

export default function JoinLobbyScreen({ navigation }: JoinLobbyScreenProps) {
  const [name, setName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinLobby = async () => {
    if (!name.trim() || !lobbyCode.trim()) return;

    setIsLoading(true);
    try {
      const code = lobbyCode.toUpperCase().trim();
      const result = await joinLobby(code, name.trim());
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Could not join lobby');
        return;
      }

      navigation.replace('Lobby', {
        lobbyCode: code,
        playerName: name.trim(),
        isHost: false,
        playerId: result.playerId!,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not join lobby. Please check the code.');
      console.error('Error joining lobby:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = name.trim() && lobbyCode.trim().length >= 4;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Text style={styles.title}>Join a Lobby</Text>
        <Text style={styles.subtitle}>Enter your name and lobby code</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#8b8b9e"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={20}
          />

          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="Lobby code"
            placeholderTextColor="#8b8b9e"
            value={lobbyCode}
            onChangeText={(text) => setLobbyCode(text.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />

          <TouchableOpacity
            style={[styles.button, !isFormValid && styles.buttonDisabled]}
            onPress={handleJoinLobby}
            disabled={!isFormValid || isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Joining...' : 'Join Lobby'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b8b9e',
    marginBottom: 40,
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
  },
  buttonDisabled: {
    backgroundColor: '#4a4a6a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 30,
  },
  backButtonText: {
    color: '#8b8b9e',
    fontSize: 16,
  },
});
