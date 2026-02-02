import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { LeadsScreen } from '../screens/LeadsScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { MoreScreen } from '../screens/MoreScreen';
import type { MainTabParamList } from './types';
import { brandColors } from '../theme/brandTheme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: brandColors.primary },
        headerTintColor: brandColors.accent,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: brandColors.accent,
        tabBarInactiveTintColor: brandColors.textMuted,
        tabBarStyle: { backgroundColor: brandColors.primary },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Leads" component={LeadsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}
