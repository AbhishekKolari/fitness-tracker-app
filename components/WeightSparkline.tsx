import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import { db } from '../db/client';
import { bodyStats } from '../db/schema';
import { desc, gte } from 'drizzle-orm';
import { useSettings } from '../contexts/SettingsContext';

const { width } = Dimensions.get('window');

export default function WeightSparkline() {
  const [data, setData] = useState<number[]>([]);
  const { settings } = useSettings();

  useEffect(() => {
    loadWeightHistory();
  }, [settings.weightUnit]);

  const loadWeightHistory = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      const stats = await db.select()
        .from(bodyStats)
        .where(gte(bodyStats.date, dateStr))
        .orderBy(desc(bodyStats.date))
        .limit(30);
      
      // Convert and reverse for chronological order
      const weights = stats.reverse().map(stat => 
        settings.weightUnit === 'kg' ? stat.weightKg : stat.weightKg * 2.20462
      );
      
      setData(weights);
    } catch (error) {
      console.error('Error loading weight history:', error);
    }
  };

  if (data.length < 2) {
    return null;
  }

  const chartWidth = width - 64;
  const chartHeight = 100;
  const padding = 10;
  
  const minWeight = Math.min(...data);
  const maxWeight = Math.max(...data);
  const range = maxWeight - minWeight || 1;
  
  const points = data.map((weight, index) => {
    const x = padding + (index / (data.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((weight - minWeight) / range) * (chartHeight - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weight (Last 30 Days)</Text>
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Polyline
            points={points}
            fill="none"
            stroke="#6200ee"
            strokeWidth="2"
          />
          {data.map((weight, index) => {
            const x = padding + (index / (data.length - 1)) * (chartWidth - padding * 2);
            const y = chartHeight - padding - ((weight - minWeight) / range) * (chartHeight - padding * 2);
            return (
              <Line
                key={index}
                x1={x}
                y1={y}
                x2={x}
                y2={chartHeight}
                stroke="#e0e0e0"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}
        </Svg>
        <Text style={styles.minMaxLabel}>{minWeight.toFixed(1)} {settings.weightUnit}</Text>
        <Text style={[styles.minMaxLabel, styles.maxLabel]}>{maxWeight.toFixed(1)} {settings.weightUnit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chartContainer: {
    position: 'relative',
  },
  minMaxLabel: {
    fontSize: 10,
    color: '#666',
    position: 'absolute',
    left: 0,
  },
  maxLabel: {
    top: 0,
  },
});
