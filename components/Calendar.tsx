import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Card, SegmentedButtons } from 'react-native-paper';
import { colors as C } from '../theme';

interface CalendarProps {
  onDateSelect: (date: string) => void;
  sessions: Array<{ date: string }>;
}

type ViewMode = 'weekly' | 'monthly';

export default function Calendar({ onDateSelect, sessions }: CalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const hasSessionOnDate = (dateStr: string) => {
    return sessions.some((s) => s.date === dateStr);
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const renderWeeklyView = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = formatDate(date);
      const hasSession = hasSessionOnDate(dateStr);

      days.push(
        <TouchableOpacity
          key={i}
          style={[styles.dayCell, isToday(date) && styles.todayCell]}
          onPress={() => onDateSelect(dateStr)}
        >
          <Text style={[styles.dayName, isToday(date) && styles.todayText]}>
            {date.toLocaleDateString('en-US', { weekday: 'short' })}
          </Text>
          <Text style={[styles.dayNumber, isToday(date) && styles.todayText]}>
            {date.getDate()}
          </Text>
          {hasSession && <View style={styles.sessionIndicator} />}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))}>
            <Text style={styles.navButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
            {new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))}>
            <Text style={styles.navButton}>→</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weekDays}>{days}</View>
      </View>
    );
  };

  const renderMonthlyView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = formatDate(date);
      const hasSession = hasSessionOnDate(dateStr);

      days.push(
        <TouchableOpacity
          key={day}
          style={[styles.dayCell, isToday(date) && styles.todayCell]}
          onPress={() => onDateSelect(dateStr)}
        >
          <Text style={[styles.dayNumber, isToday(date) && styles.todayText]}>{day}</Text>
          {hasSession && <View style={styles.sessionIndicator} />}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.monthContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
            <Text style={styles.navButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
            <Text style={styles.navButton}>→</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weekdayHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text key={day} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.monthDays}>{days}</View>
      </View>
    );
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <SegmentedButtons
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
            buttons={[
              { value: 'weekly', label: 'Week' },
              { value: 'monthly', label: 'Month' },
            ]}
            style={styles.segmentedButtons}
          />
        </View>
        {viewMode === 'weekly' ? renderWeeklyView() : renderMonthlyView()}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, backgroundColor: C.surface, borderRadius: 16 },
  header: { marginBottom: 16 },
  segmentedButtons: {},
  weekContainer: {},
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekLabel: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: 44,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: C.surfaceElevated,
  },
  todayCell: { backgroundColor: C.move },
  dayName: { fontSize: 11, color: C.textSecondary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNumber: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  todayText: { color: '#fff' },
  sessionIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.exercise,
    marginTop: 4,
  },
  navButton: { fontSize: 22, fontWeight: '600', paddingHorizontal: 12, color: C.textPrimary },
  monthContainer: {},
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthLabel: { fontSize: 18, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.3 },
  weekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: { fontSize: 11, fontWeight: '600', color: C.textSecondary, width: 44, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  monthDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
  },
});
