import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { MainTabs } from './MainTabs';
import { PlaceholderAdminScreen } from '../screens/PlaceholderAdminScreen';
import type { RootStackParamList } from './types';
import { brandColors } from '../theme/brandTheme';

const Drawer = createDrawerNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: brandColors.primary },
        headerTintColor: brandColors.accent,
        drawerStyle: { backgroundColor: brandColors.surface },
        drawerActiveTintColor: brandColors.primary,
        drawerInactiveTintColor: brandColors.textMuted,
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ title: 'Main', drawerLabel: 'Main' }}
      />
      <Drawer.Screen name="Batches" component={() => <PlaceholderAdminScreen title="Batches" />} />
      <Drawer.Screen name="Centers" component={() => <PlaceholderAdminScreen title="Centers" />} />
      <Drawer.Screen name="Users" component={() => <PlaceholderAdminScreen title="Users" />} />
    </Drawer.Navigator>
  );
}
