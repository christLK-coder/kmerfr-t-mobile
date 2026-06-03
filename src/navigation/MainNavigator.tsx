// Navigateur principal — routing selon le rôle (IMPORTER / DRIVER)
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useColors } from '../theme/theme';
import { Light } from '../theme/colors';
import { LoadingOverlay } from '../components/common/LoadingOverlay';

import ImporterHomeScreen   from '../screens/importer/ImporterHomeScreen';
import CreateMissionScreen  from '../screens/importer/CreateMissionScreen';
import MissionDetailScreen  from '../screens/importer/MissionDetailScreen';
import DriverHomeScreen     from '../screens/driver/DriverHomeScreen';
import ActiveMissionScreen  from '../screens/driver/ActiveMissionScreen';
import QRScanScreen         from '../screens/driver/QRScanScreen';
import ProfileScreen        from '../screens/shared/ProfileScreen';
import DocumentScanScreen   from '../screens/shared/DocumentScanScreen';
import AlertScreen          from '../screens/AlertScreen';
import MapScreen            from '../screens/shared/MapScreen';
import RatingScreen         from '../screens/shared/RatingScreen';
import StatsScreen          from '../screens/shared/StatsScreen';
import TruckScreen          from '../screens/driver/TruckScreen';
import DisputeScreen        from '../screens/shared/DisputeScreen';
import LoyaltyScreen           from '../screens/driver/LoyaltyScreen';
import ChatScreen              from '../screens/shared/ChatScreen';
import PaymentScreen           from '../screens/shared/PaymentScreen';
import AdminDashboardScreen    from '../screens/admin/AdminDashboardScreen';
import AdminApplicationsScreen from '../screens/admin/AdminApplicationsScreen';
import AdminOperationsScreen   from '../screens/admin/AdminOperationsScreen';
import AdminAccountsScreen     from '../screens/admin/AdminAccountsScreen';
import AdminFinanceScreen      from '../screens/admin/AdminFinanceScreen';
import AdminApplicationChatScreen from '../screens/admin/AdminApplicationChatScreen';
import ChangePasswordScreen    from '../screens/shared/ChangePasswordScreen';

// ─── Param lists ──────────────────────────────────────────────────────────────

export type ImporterTabParamList = {
  ImporterHome: undefined;
  ImMap: undefined;
  ImProfile: undefined;
};

export type DriverTabParamList = {
  DriverHome: undefined;
  DrMap: undefined;
  DrProfile: undefined;
};

export type MainStackParamList = {
  ImporterTabs: undefined;
  DriverTabs: undefined;
  AdminTabs: undefined;
  CreateMission: undefined;
  MissionDetail: { missionId: string };
  ActiveMission: { missionId?: string };
  QRScan: { missionId?: string };
  DocumentScan: { missionId: string };
  Alert: { missionId?: string };
  Map: undefined;
  Rating: { missionId: string; reviewedName: string };
  Stats: undefined;
  Trucks: undefined;
  Dispute: { missionId: string };
  Loyalty: undefined;
  Chat: { missionId: string; otherPartyName: string };
  Payment: { missionId: string; amount: number; missionLabel: string; isSecondPayment?: boolean };
  Notifications: undefined;
  AdminApplications: undefined;
  AdminOperations: undefined;
  AdminAccounts: undefined;
  AdminFinance: undefined;
  AdminApplicationChat: { applicationId: string; applicantName: string };
  ChangePassword: undefined;
};

// ─── Navigateurs ─────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<MainStackParamList>();
const ImpTab = createBottomTabNavigator<ImporterTabParamList>();
const DrvTab = createBottomTabNavigator<DriverTabParamList>();
const AdmTab = createBottomTabNavigator();

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function useTabOptions() {
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  return {
    tabBarActiveTintColor: C.primary,
    tabBarInactiveTintColor: C.textMuted,
    headerShown: false,
    tabBarStyle: {
      backgroundColor: C.surface,
      borderTopWidth: 0,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowOffset: { width: 0, height: -4 },
      shadowRadius: 12,
      height: 62,
      paddingBottom: 8,
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  };
}

function useTabIcon() {
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  return (name: IconName, focused: boolean) => (
    <MaterialCommunityIcons
      name={focused ? name : (`${name}-outline` as IconName)}
      size={24}
      color={focused ? C.primary : C.textMuted}
    />
  );
}

function ImporterTabsNavigator() {
  const opts = useTabOptions();
  const icon = useTabIcon();
  return (
    <ImpTab.Navigator screenOptions={opts}>
      <ImpTab.Screen name="ImporterHome" component={ImporterHomeScreen}
        options={{ title: 'Missions', tabBarIcon: ({ focused }) => icon('truck-delivery', focused) }} />
      <ImpTab.Screen name="ImMap" component={MapScreen}
        options={{ title: 'Carte', tabBarIcon: ({ focused }) => icon('map', focused) }} />
      <ImpTab.Screen name="ImProfile" component={ProfileScreen}
        options={{ title: 'Profil', tabBarIcon: ({ focused }) => icon('account-circle', focused) }} />
    </ImpTab.Navigator>
  );
}

function DriverTabsNavigator() {
  const opts = useTabOptions();
  const icon = useTabIcon();
  return (
    <DrvTab.Navigator screenOptions={opts}>
      <DrvTab.Screen name="DriverHome" component={DriverHomeScreen}
        options={{ title: 'Disponibles', tabBarIcon: ({ focused }) => icon('clipboard-list', focused) }} />
      <DrvTab.Screen name="DrMap" component={MapScreen}
        options={{ title: 'Carte', tabBarIcon: ({ focused }) => icon('map', focused) }} />
      <DrvTab.Screen name="DrProfile" component={ProfileScreen}
        options={{ title: 'Profil', tabBarIcon: ({ focused }) => icon('account-circle', focused) }} />
    </DrvTab.Navigator>
  );
}

// ─── Navigateur principal ────────────────────────────────────────────────────

function AdminTabsNavigator() {
  const opts = useTabOptions();
  const icon = useTabIcon();
  return (
    <AdmTab.Navigator screenOptions={opts}>
      <AdmTab.Screen name="AdminDash" component={AdminDashboardScreen}
        options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => icon('view-dashboard', focused) }} />
      <AdmTab.Screen name="AdminApps" component={AdminApplicationsScreen}
        options={{ title: 'Candidatures', tabBarIcon: ({ focused }) => icon('account-clock', focused) }} />
      <AdmTab.Screen name="AdminProfile" component={ProfileScreen as any}
        options={{ title: 'Profil', tabBarIcon: ({ focused }) => icon('account-circle', focused) }} />
    </AdmTab.Navigator>
  );
}

export function MainNavigator() {
  const { userRole } = useAuthStore();
  if (!userRole) return <LoadingOverlay visible message="Chargement…" />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userRole === 'IMPORTER' ? (
        <Stack.Screen name="ImporterTabs" component={ImporterTabsNavigator} />
      ) : userRole === 'ADMIN' ? (
        <Stack.Screen name="AdminTabs" component={AdminTabsNavigator} />
      ) : (
        <Stack.Screen name="DriverTabs" component={DriverTabsNavigator} />
      )}
      <Stack.Screen name="CreateMission"  component={CreateMissionScreen}  options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="MissionDetail"  component={MissionDetailScreen}  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ActiveMission"  component={ActiveMissionScreen}  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="QRScan"         component={QRScanScreen}         options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="DocumentScan"   component={DocumentScanScreen}   options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Alert"          component={AlertScreen}          options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Map"            component={MapScreen}            options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Rating"         component={RatingScreen}         options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Stats"          component={StatsScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Trucks"         component={TruckScreen}          options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Dispute"        component={DisputeScreen}        options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Loyalty"        component={LoyaltyScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Chat"              component={ChatScreen}              options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Payment"           component={PaymentScreen}           options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="AdminApplications" component={AdminApplicationsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminOperations"   component={AdminOperationsScreen}   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminAccounts"     component={AdminAccountsScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminFinance"      component={AdminFinanceScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminApplicationChat" component={AdminApplicationChatScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ChangePassword"   component={ChangePasswordScreen}   options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
