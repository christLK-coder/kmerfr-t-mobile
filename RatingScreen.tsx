// Notation apres livraison — etoiles + commentaire
import React, { useState } from 'react';
import {
  View, StyleSheet, StatusBar, TouchableOpacity,
  ScrollView, Alert, Animated,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createReviewApi } from '../../api/reviews.api';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'Rating'>;

const STAR_COLOR_FILLED = '#F9A825';
const LABELS = ['', 'Tres mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent'];

function StarRow({ rating, onRate, outlineColor }: { rating: number; onRate: (n: number) => void; outlineColor: string }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onRate(n)} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={n <= rating ? 'star' : 'star-outline'}
            size={52}
            color={n <= rating ? STAR_COLOR_FILLED : outlineColor}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function RatingScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { missionId, reviewedName } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0));

  async function handleSubmit() {
    if (rating === 0) { Alert.alert(t('val_required'), 'Selectionnez au moins 1 etoile'); return; }
    setLoading(true);
    try {
      await createReviewApi({ missionId, rating, comment: comment.trim() || undefined });
      setDone(true);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 5 }).start();
    } catch (err: any) {
      Alert.alert(t('err_unknown'), err?.message ?? t('err_server'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header leger */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.surfaceVariant }]}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>{t('stats_avg_rating')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {done ? (
          <View style={styles.doneContainer}>
            <Animated.View style={[styles.doneIcon, { transform: [{ scale: scaleAnim }] }]}>
              <MaterialCommunityIcons name="check-circle" size={96} color={C.success} />
            </Animated.View>
            <Text style={[styles.doneTitle, { color: C.textPrimary }]}>Merci !</Text>
            <Text style={[styles.doneSub, { color: C.textSecondary }]}>
              Votre avis aide a ameliorer la qualite du service.
            </Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: C.primary }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.doneBtnText, { color: C.onPrimary }]}>{t('common_close')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={[styles.avatar, { backgroundColor: C.primaryContainer }]}>
                <Text style={[styles.avatarText, { color: C.onPrimaryContainer }]}>
                  {getInitials(reviewedName)}
                </Text>
              </View>
              <Text style={[styles.reviewedName, { color: C.textPrimary }]}>{reviewedName}</Text>
            </View>

            {/* Stars */}
            <View style={[styles.card, { backgroundColor: C.surface }]}>
              <StarRow rating={rating} onRate={setRating} outlineColor={C.outline} />
              {rating > 0 && (
                <Text style={[styles.ratingLabel, { color: STAR_COLOR_FILLED }]}>{LABELS[rating]}</Text>
              )}
            </View>

            {/* Comment */}
            <View style={[styles.card, { backgroundColor: C.surface }]}>
              <TextInput
                mode="outlined"
                label={t('dispute_desc')}
                placeholder="Decrivez votre experience..."
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                maxLength={500}
                style={styles.commentInput}
                outlineColor={C.outline}
                activeOutlineColor={C.primary}
                textColor={C.textPrimary}
              />
              <Text style={[styles.charCount, { color: C.textMuted }]}>{comment.length}/500</Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: C.primary },
                (rating === 0 || loading) && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={rating === 0 || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={20} color={C.onPrimary} />
                  <Text style={[styles.submitBtnText, { color: C.onPrimary }]}>{t('common_send')}</Text>
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
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  body: { padding: 16, gap: 24, alignItems: 'center' },

  avatarSection: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800' },
  reviewedName: { fontSize: 18, fontWeight: '700' },

  card: {
    width: '100%', borderRadius: 14, padding: 16, gap: 8,
    elevation: 1, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },

  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  ratingLabel: { fontSize: 16, fontWeight: '700', textAlign: 'center' },

  commentInput: { width: '100%', minHeight: 100 },
  charCount: { fontSize: 11, textAlign: 'right', width: '100%' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', borderRadius: 14, paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800' },

  doneContainer: { alignItems: 'center', gap: 16, marginTop: 48 },
  doneIcon: { marginBottom: 8 },
  doneTitle: { fontSize: 24, fontWeight: '800' },
  doneSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  doneBtn: { marginTop: 16, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13 },
  doneBtnText: { fontWeight: '700', fontSize: 15 },
});
