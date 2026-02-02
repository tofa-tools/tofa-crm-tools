import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StandardText } from '../components/StandardText';
import { StandardButton } from '../components/StandardButton';
import { useAuth } from '../context/AuthContext';
import { brandColors } from '../theme/brandTheme';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      // AuthContext updates user → App re-renders and shows MainTabs (no explicit navigation needed)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Alert.alert('Sign In Failed', message || 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputBorder = (focused: boolean) => ({
    borderWidth: 2,
    borderColor: focused ? brandColors.accent : 'rgba(212, 175, 55, 0.4)',
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <StandardText variant="heading" style={styles.title}>
          Welcome
        </StandardText>
        <StandardText variant="muted" style={styles.subtitle}>
          Sign in to continue
        </StandardText>

        <TextInput
          style={[styles.input, inputBorder(emailFocused)]}
          placeholder="Email"
          placeholderTextColor={brandColors.textMuted}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          style={[styles.input, inputBorder(passwordFocused)]}
          placeholder="Password"
          placeholderTextColor={brandColors.textMuted}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          secureTextEntry
          editable={!loading}
        />

        <View style={styles.buttonWrap}>
          {loading ? (
            <ActivityIndicator size="large" color={brandColors.accent} />
          ) : (
            <StandardButton title="Sign In" onPress={handleSignIn} variant="accent" />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    color: brandColors.textOnPrimary,
    fontSize: 28,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: brandColors.textOnPrimary,
    opacity: 0.8,
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: brandColors.textOnPrimary,
    marginBottom: 16,
  },
  buttonWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
});
