// Notation après livraison — étoiles + commentaire
import React, { useState } from 'react';
import {
  View, StyleSheet, StatusBar, TouchableOpacity,
  TextInput, ScrollView, Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createReviewApi } from '../../api/reviews.api';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'Rating'>;

function StarRow({ rating, onRate }: { rating: number; onRate: (n: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onRate(n)} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={n <= rating ? 'star' : 'star-outline'}
            size={48}
            color={n <= rating ? '#F57F17' : '#E0E0E0'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const LABELS = ['', 'Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent'];

export default function RatingScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { missionId, reviewedName } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (rating === 0) { Alert.alert('Note requise', 'Sélectionnez au moins 1 étoile'); return; }
    setLoading(true);
    try {
      await createReviewApi({ missionId, rating, comment: comment.trim() || undefined });
      setDone(true);
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Erreur lors de la notation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#F57F17', '#F9A825', '#FBC02D']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <MaterialCommunityIcons name="star-circle" size={36} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Notez votre expérience</Text>
        <Text style={styles.headerSub}>{reviewedName}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        {done ? (
          <View style={styles.doneCard}>
            <MaterialCommunityIcons name="check-circle" size={64} color="#2E7D32" />
            <Text style={styles.doneTitle}>Merci pour votre note !</Text>
            <Text style={styles.doneSub}>Votre avis aide à améliorer la qualité du service.</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Votre note</Text>
              <StarRow rating={rating} onRate={setRating} />
              {rating > 0 && (
                <Text style={styles.ratingLabel}>{LABELS[rating]}</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Commentaire (optionnel)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Décrivez votre expérience…"
                placeholderTextColor="#BDBDBD"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                maxLength={500}
              />
              <Text style={styles.charCount}>{comment.length}/500</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, (rating === 0 || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={rating === 0 || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Envoyer ma note</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    paddingHorizontal: 20, paddingBottom: 24,
    alignItems: 'flex-start', gap: 6,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  body: { padding: 16, gap: 16 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5 },

  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  ratingLabel: { fontSize: 16, fontWeight: '700', color: '#F57F17', textAlign: 'center' },

  commentInput: {
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12,
    padding: 12, fontSize: 14, color: '#212121',
    minHeight: 100, textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: '#BDBDBD', textAlign: 'right' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F57F17', borderRadius: 14, paddingVertical: 16,
    elevation: 4, shadowColor: '#F57F17', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  submitBtnDisabled: { backgroundColor: '#FFCC80' },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  doneCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32,
    alignItems: 'center', gap: 12, marginTop: 40,
    elevation: 3,
  },
  doneTitle: { fontSize: 20, fontWeight: '800', color: '#2E7D32' },
  doneSub: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },
  doneBtn: {
    marginTop: 8, backgroundColor: '#1B5E20', borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 13,
  },
  doneBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
