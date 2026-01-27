import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function Index() {
  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        // User is logged in, redirect handled by layout
      }
    };
    checkAuth();
  }, []);

  // Redirect to login by default
  return <Redirect href="/login" />;
}

