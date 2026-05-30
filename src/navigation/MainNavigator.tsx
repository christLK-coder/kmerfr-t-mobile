// Navigateur principal — routing selon le rôle (IMPORTER / DRIVER)
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { KmerFretColors } from '../theme/theme';
import { LoadingOverlay } from '../components/common/LoadingOverlay';

import ImporterHomeScreen from '../screens/importer/ImporterHomeScreen';
import CreateMissionScreen from '../screens/importer/CreateMissionScreen';
import MissionDetailScreen from '../screens/importer/MissionDetailScreen';
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import ActiveMissionScreen from '../screens/driver/ActiveMissionScreen';
import QRScanScreen from '../screens/driver/QRScanScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import DocumentScanScreen from '../screens/shared/DocumentScanScreen';
import AlertScreen from '../screens/AlertScreen';

// ─── Param lists ──────────────────────────────────────────────────────────────

export type ImporterTabParamList = {
  ImporterHome: undefined;
  ImProfile: undefined;
};

export type DriverTabParamList = {
  DriverHome: undefined;
  DrProfile: undefined;
};

export type MainStackParamList = {
  ImporterTabs: undefined;
  DriverTabs: undefined;
  CreateMission: undefined;
  MissionDetail: { missionId: string };
  ActiveMission: {
    missionId: string;
    originLabel: string;
    destinationLabel: string;
  };
  QRScan: { missionId: string };
  DocumentScan: { missionId: string };
  Alert: { missionId?: string };
};

// ─── Navigateurs ─────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<MainStackParamList>();
const ImpTab = createBottomTabNavigator<ImporterTabParamList>();
const DrvTab = createBottomTabNavigator<DriverTabParamList>();

const TAB_OPTIONS = {
  tabBarActiveTintColor: KmerFretColors.primary,
  tabBarInactiveTintColor: '#9E9E9E',
  headerShown: false,
  tabBarStyle: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    height: 62,
    paddingBottom: 8,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
};

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(name: IconName, focused: boolean) {
  return (
    <MaterialCommunityIcons
      name={focused ? name : (`${name}-outline` as IconName)}
      size={24}
      color={focused ? KmerFretColors.primary : '#9E9E9E'}
    />
  );
}

function ImporterTabsNavigator() {
  return (
    <ImpTab.Navigator screenOptions={TAB_OPTIONS}>
      <ImpTab.Screen
        name="ImporterHome"
        component={ImporterHomeScreen}
        options={{
          title: 'Missions',
          tabBarIcon: ({ focused }) => tabIcon('truck-delivery', focused),
        }}
      />
      <ImpTab.Screen
        name="ImProfile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => tabIcon('account-circle', focused),
        }}
      />
    </ImpTab.Navigator>
  );
}

function DriverTabsNavigator() {
  return (
    <DrvTab.Navigator screenOptions={TAB_OPTIONS}>
      <DrvTab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{
          title: 'Disponibles',
          tabBarIcon: ({ focused }) => tabIcon('clipboard-list', focused),
        }}
      />
      <DrvTab.Screen
        name="DrProfile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => tabIcon('account-circle', focused),
        }}
      />
    </DrvTab.Navigator>
  );
}

// ─── Navigateur principal ────────────────────────────────────────────────────

export function MainNavigator() {
  const { userRole } = useAuthStore();

  if (!userRole) return <LoadingOverlay visible message="Chargement…" />;

  const isImporter = userRole === 'IMPORTER';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isImporter ? (
        <Stack.Screen name="ImporterTabs" component={ImporterTabsNavigator} />
      ) : (
        <Stack.Screen name="DriverTabs" component={DriverTabsNavigator} />
      )}
      <Stack.Screen
        name="CreateMission"
        component={CreateMissionScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="MissionDetail"
        component={MissionDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ActiveMission"
        component={ActiveMissionScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="QRScan"
        component={QRScanScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DocumentScan"
        component={DocumentScanScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Alert"
        component={AlertScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
