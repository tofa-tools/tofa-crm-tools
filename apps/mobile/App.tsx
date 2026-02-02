/**
 * TOFA Mobile - React Native CLI
 * Auth gate: LoginScreen → MainTabs + Drawer (Command Center).
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { brandColors } from './src/theme/brandTheme';

const queryClient = new QueryClient();

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={brandColors.accent} />
      </View>
    );
  }
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor={brandColors.primary} />
          <AppContent />
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: brandColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
