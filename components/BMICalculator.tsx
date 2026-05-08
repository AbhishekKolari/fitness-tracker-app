import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, TextInput, Button, Text } from 'react-native-paper';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { bodyStats } from '../db/schema';
import { useSettings } from '../contexts/SettingsContext';
import WeightSparkline from './WeightSparkline'; 

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
      const today = new Date().toISOString().split('T')[0];

      const weightKgValue =
        settings.weightUnit === 'kg'
          ? parseFloat(weight)
          : parseFloat(weight) * 0.453592;

      const heightCmValue =
        settings.heightUnit === 'cm'
          ? parseFloat(height)
          : (parseFloat(heightFt) * 12 + parseFloat(heightIn)) * 2.54;

      const existing = await db
        .select()
        .from(bodyStats)
        .where(eq(bodyStats.date, today));

      if (existing.length > 0) {
        await db.update(bodyStats)
          .set({ weightKg: weightKgValue, heightCm: heightCmValue })
          .where(eq(bodyStats.id, existing[0].id));
      } else {
        await db.insert(bodyStats)
          .values({ date: today, weightKg: weightKgValue, heightCm: heightCmValue });
      }

      onBMISaved?.();
    } catch (error) {
      console.error('Error saving BMI:', error);
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

            <WeightSparkline />
          </>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 4, marginTop: 8 },
  input: { marginBottom: 8 },
  heightRow: { flexDirection: 'row', gap: 8 },
  heightInput: { flex: 1 },
  resultContainer: { alignItems: 'center', marginVertical: 16 },
  bmiValue: { fontSize: 48, fontWeight: 'bold' },
  category: { fontSize: 24, fontWeight: '600', marginTop: 4 },
  barContainer: { marginVertical: 16 },
  barBackground: {
    height: 12,
    backgroundColor: '#e0e0e0',
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
  barLabel: { fontSize: 12, color: '#666' },
  saveButton: { marginTop: 8 },
});
