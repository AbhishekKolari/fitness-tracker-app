import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';

interface Settings {
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  activeProgramId: number | null;
}

interface SettingsContextType {
  settings: Settings;
  loaded: boolean;
  updateWeightUnit: (unit: WeightUnit) => void;
  updateHeightUnit: (unit: HeightUnit) => void;
  setActiveProgramId: (id: number | null) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'kg',
  heightUnit: 'cm',
  activeProgramId: null,
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('settings');
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoaded(true);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem('settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const updateWeightUnit = (unit: WeightUnit) => {
    const next = { ...settings, weightUnit: unit };
    setSettings(next);
    saveSettings(next);
  };

  const updateHeightUnit = (unit: HeightUnit) => {
    const next = { ...settings, heightUnit: unit };
    setSettings(next);
    saveSettings(next);
  };

  const setActiveProgramId = (id: number | null) => {
    const next = { ...settings, activeProgramId: id };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <SettingsContext.Provider value={{ settings, loaded, updateWeightUnit, updateHeightUnit, setActiveProgramId }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
