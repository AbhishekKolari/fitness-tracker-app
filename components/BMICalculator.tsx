import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, TextInput, Button, Text, Snackbar, Portal } from 'react-native-paper';
import { colors as C } from '../theme';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { bodyStats } from '../db/schema';
import { useSettings } from '../contexts/SettingsContext';
import { localDateStr } from '../utils/date';

interface BMICalculatorProps {
  onBMISaved?: () => void;
}

export default function BMICalculator({ onBMISaved }: BMICalculatorProps) {
  const { settings } = useSettings();
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [bmi, setBMI] = useState<number | null>(null);
  const [category, setCategory] = useState('');
  const [categoryColor, setCategoryColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<{ date: string; weightKg: number; heightCm: number | null } | null>(null);

  const loadLastSaved = () => {
    try {
      const row = db.select().from(bodyStats).where(eq(bodyStats.date, localDateStr())).get();
      if (row) setLastSaved({ date: row.date, weightKg: row.weightKg, heightCm: row.heightCm ?? null });
      else setLastSaved(null);
    } catch {}
  };

  useEffect(() => {
    loadLastSaved();
  }, []);

  const calculateBMI = () => {
    let weightKg: number;
    let heightM: number;

    weightKg =
      settings.weightUnit === 'kg'
        ? parseFloat(weight)
        : parseFloat(weight) * 0.453592;

    if (settings.heightUnit === 'cm') {
      heightM = parseFloat(height) / 100;
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      heightM = (ft * 12 + inches) * 0.0254;
    }

    if (weightKg && heightM && heightM > 0) {
      const value = weightKg / (heightM * heightM);
      setBMI(value);

      if (value < 18.5) {
        setCategory('Underweight');
        setCategoryColor('#3498db');
      } else if (value < 25) {
        setCategory('Normal');
        setCategoryColor('#2ecc71');
      } else if (value < 30) {
        setCategory('Overweight');
        setCategoryColor('#f39c12');
      } else {
        setCategory('Obese');
        setCategoryColor('#e74c3c');
      }
    }
  };

  const saveBMI = async () => {
    if (!bmi) return;
    setSaving(true);
    try {
      const today = localDateStr();

      const weightKgValue =
        settings.weightUnit === 'kg'
          ? parseFloat(weight)
          : parseFloat(weight) * 0.453592;

      const heightCmValue =
        settings.heightUnit === 'cm'
          ? parseFloat(height)
          : (parseFloat(heightFt) * 12 + parseFloat(heightIn)) * 2.54;

      const existing = db
        .select()
        .from(bodyStats)
        .where(eq(bodyStats.date, today))
        .all();

      if (existing.length > 0) {
        db.update(bodyStats)
          .set({ weightKg: weightKgValue, heightCm: heightCmValue })
          .where(eq(bodyStats.id, existing[0].id))
          .run();
      } else {
        db.insert(bodyStats)
          .values({ date: today, weightKg: weightKgValue, heightCm: heightCmValue })
          .run();
      }

      setSnackbar('BMI entry saved');
      loadLastSaved();
      onBMISaved?.();
    } catch (error) {
      console.error('Error saving BMI:', error);
      setSnackbar('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (weight && (settings.heightUnit === 'cm' ? height : heightFt)) {
      calculateBMI();
    }
  }, [weight, height, heightFt, heightIn, settings.weightUnit, settings.heightUnit]);

  const getBMIProgress = () => {
    if (!bmi) return 0;
    return Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100));
  };

  const bmiProgress = getBMIProgress();

  return (
    <Card style={styles.card}>
      <Card.Title title="BMI Calculator" />
      <Card.Content>
        <Text style={styles.label}>Weight ({settings.weightUnit})</Text>
        <TextInput
          mode="outlined"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder={`Enter weight in ${settings.weightUnit}`}
          style={styles.input}
        />

        {settings.heightUnit === 'cm' ? (
          <>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              mode="outlined"
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              placeholder="Enter height in cm"
              style={styles.input}
            />
          </>
        ) : (
          <View style={styles.heightRow}>
            <View style={styles.heightInput}>
              <Text style={styles.label}>Height (ft)</Text>
              <TextInput
                mode="outlined"
                value={heightFt}
                onChangeText={setHeightFt}
                keyboardType="numeric"
                placeholder="ft"
                style={styles.input}
              />
            </View>
            <View style={styles.heightInput}>
              <Text style={styles.label}>Height (in)</Text>
              <TextInput
                mode="outlined"
                value={heightIn}
                onChangeText={setHeightIn}
                keyboardType="numeric"
                placeholder="in"
                style={styles.input}
              />
            </View>
          </View>
        )}

        {bmi && (
          <>
            <View style={styles.resultContainer}>
              <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
              <Text style={[styles.category, { color: categoryColor }]}>{category}</Text>
            </View>

            <View style={styles.barContainer}>
              <View style={styles.barBackground}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${bmiProgress}%`, backgroundColor: categoryColor },
                  ]}
                />
                <View
                  style={[
                    styles.indicator,
                    { left: `${bmiProgress}%`, backgroundColor: categoryColor },
                  ]}
                />
              </View>
              <View style={styles.barLabels}>
                <Text style={styles.barLabel}>15</Text>
                <Text style={styles.barLabel}>25</Text>
                <Text style={styles.barLabel}>35</Text>
              </View>
            </View>

            <Button
              mode="contained"
              onPress={saveBMI}
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            >
              Save Entry
            </Button>
          </>
        )}

        {lastSaved && (
          <View style={styles.lastSavedRow}>
            <Text style={styles.lastSavedLabel}>Saved today</Text>
            <Text style={styles.lastSavedValue}>
              {settings.weightUnit === 'kg'
                ? `${lastSaved.weightKg.toFixed(1)} kg`
                : `${(lastSaved.weightKg * 2.20462).toFixed(1)} lbs`}
              {lastSaved.heightCm && lastSaved.heightCm > 0
                ? `  ·  BMI ${(lastSaved.weightKg / Math.pow(lastSaved.heightCm / 100, 2)).toFixed(1)}`
                : ''}
            </Text>
          </View>
        )}

      </Card.Content>
      <Portal>
        <Snackbar
          visible={!!snackbar}
          onDismiss={() => setSnackbar(null)}
          duration={2000}
          style={{ backgroundColor: C.surfaceElevated }}
          wrapperStyle={{ bottom: 80 }}
        >
          {snackbar}
        </Snackbar>
      </Portal>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, backgroundColor: C.surface, borderRadius: 16 },
  label: { fontSize: 13, marginBottom: 4, marginTop: 8, color: C.textSecondary },
  input: { marginBottom: 8, backgroundColor: C.surfaceElevated },
  heightRow: { flexDirection: 'row', gap: 8 },
  heightInput: { flex: 1 },
  resultContainer: { alignItems: 'center', marginVertical: 16 },
  bmiValue: { fontSize: 48, fontWeight: '800', color: C.textPrimary, letterSpacing: -1 },
  category: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  barContainer: { marginVertical: 16 },
  barBackground: {
    height: 12,
    backgroundColor: C.surfaceElevated,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 6 },
  indicator: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barLabel: { fontSize: 12, color: C.textSecondary },
  saveButton: { marginTop: 8, borderRadius: 12 },
  lastSavedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.surfaceElevated,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  lastSavedLabel: {
    fontSize: 11,
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    flexShrink: 0,
  },
  lastSavedValue: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  },
});
