import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OtpVerifyScreen from '../screens/auth/OtpVerifyScreen';
import DriverApplyScreen from '../screens/auth/DriverApplyScreen';
import DriverOnboardingScreen from '../screens/auth/DriverOnboardingScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OtpVerify: undefined;
  DriverApply: undefined;
  DriverOnboarding: { applicationId: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="DriverApply" component={DriverApplyScreen} />
      <Stack.Screen name="DriverOnboarding" component={DriverOnboardingScreen} />
    </Stack.Navigator>
  );
}
