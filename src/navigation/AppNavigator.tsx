// Navigateur racine — bascule Auth ↔ Main selon la session SQLite
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { useAuthStore } from '../store/authStore';
import { initDatabase } from '../database/schema';

export function AppNavigator() {
  const { isAuthenticated, isLoading, checkSession } = useAuthStore();

  useEffect(() => {
    // Initialiser la DB SQLite puis vérifier la session persistée
    initDatabase()
      .then(() => checkSession())
      .catch(() => checkSession());
  }, []);

  if (isLoading) {
    return <LoadingOverlay visible message="Chargement…" />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
