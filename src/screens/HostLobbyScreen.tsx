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
import { createLobby } from '../services';

type HostLobbyScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'HostLobby'>;
};

export default function HostLobbyScreen({ navigation }: HostLobbyScreenProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateLobby = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const { lobbyCode, playerId } = await createLobby(name.trim());
      
      navigation.replace('Lobby', {
        lobbyCode,
        playerName: name.trim(),
        isHost: true,
        playerId,
      });
    } catch (error) {
      console.error('Error creating lobby:', error);
      Alert.alert('Error', 'Could not create lobby. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Text style={styles.title}>Host a Lobby</Text>
        <Text style={styles.subtitle}>Enter your name to create a game</Text>

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

          <TouchableOpacity
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={handleCreateLobby}
            disabled={!name.trim() || isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating...' : 'Create Lobby'}
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
