import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { authAPI, tokenStorage } from '@/lib/api';
import { TOFA_THEME } from '@/constants/theme';
import { LogIn } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.login(email, password);
      
      // Save token and user data
      await tokenStorage.setToken(response.access_token);
      await tokenStorage.setUser({ email, role: response.role });
      
      // Navigate to coach dashboard
      router.replace('/coach/dashboard');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Login failed';
      Alert.alert('Login Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Header */}
        <View style={styles.header}>
          <LogIn size={48} style={{ color: TOFA_THEME.colors.gold }} />
          <Text style={styles.title}>TOFA Coach</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={TOFA_THEME.colors.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={TOFA_THEME.colors.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={TOFA_THEME.colors.navy} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOFA_THEME.colors.navy,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: TOFA_THEME.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: TOFA_THEME.spacing.xxl,
  },
  title: {
    fontSize: TOFA_THEME.typography.fontSize.xxxl,
    fontWeight: 'bold',
    color: TOFA_THEME.colors.gold,
    marginTop: TOFA_THEME.spacing.md,
  },
  subtitle: {
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.textSecondary,
    marginTop: TOFA_THEME.spacing.sm,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: TOFA_THEME.colors.background,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    marginBottom: TOFA_THEME.spacing.md,
    fontSize: TOFA_THEME.typography.fontSize.md,
    color: TOFA_THEME.colors.text,
    ...TOFA_THEME.shadows.sm,
  },
  button: {
    backgroundColor: TOFA_THEME.colors.gold,
    borderRadius: TOFA_THEME.borderRadius.md,
    padding: TOFA_THEME.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TOFA_THEME.spacing.md,
    ...TOFA_THEME.shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: TOFA_THEME.colors.navy,
    fontSize: TOFA_THEME.typography.fontSize.lg,
    fontWeight: 'bold',
  },
});

