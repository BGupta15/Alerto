import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Vibration,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Voice from '@react-native-voice/voice';
import { PermissionsAndroid, Platform } from 'react-native';

export default function HomeScreen() {
  const [location, setLocation] = useState<any>(null);
  const [watching, setWatching] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const lastLocationRef = useRef<any>(null);
  const unchangedTimeRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const SOS_ENDPOINT = 'http://192.168.29.196:3000/api/trigger-sos';
  const emergencyContact = '+916395526762';

  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission needed', 'Microphone is required for voice SOS');
      }
    }
  };

  const onSpeechResults = (e: any) => {
    const spoken = e.value[0].toLowerCase();
    console.log('🎤 Heard:', spoken);

    if (
      spoken.includes('help') ||
      spoken.includes('sos') ||
      spoken.includes('emergency')
    ) {
      manualSOS(); // 🚨 Trigger SOS
    }
  };

  const onSpeechError = (e: any) => {
    console.log('❌ Voice Error:', e);
    // Try restarting voice if it stops unexpectedly
    setTimeout(() => {
      startListening();
    }, 1000);
  };

  const startListening = async () => {
    try {
      await Voice.start('en-US');
    } catch (e) {
      console.error('🔁 Voice start error:', e);
    }
  };


  const manualSOS = async () => {
    if (
      !location ||
      typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number'
    ) {
      Alert.alert('Location Error', 'Location not available. Try again.');
      return;
    }
    await sendSOS(location, 'Manual SOS triggered by user');
  };

  const sendSOS = async (loc: any, notes: string) => {
    try {
      await axios.post(SOS_ENDPOINT, {
        name: 'Test User',
        lat: loc.latitude,
        lon: loc.longitude,
        contact: emergencyContact,
        notes,
      });
      Alert.alert('SOS Sent', 'Emergency message was sent.');
    } catch (error) {
      console.log('Error:', error);
      Alert.alert('SOS Failed', 'Could not send emergency alert.');
    }
  };

  const startTrip = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Error', 'Permission to access location was denied');
      return;
    }

    let loc = await Location.getCurrentPositionAsync({});
    if (
      loc?.coords &&
      typeof loc.coords.latitude === 'number' &&
      typeof loc.coords.longitude === 'number'
    ) {
      setLocation(loc.coords);
      lastLocationRef.current = loc.coords;
    } else {
      Alert.alert('Location Error', 'Location not available. Try again.');
      return;
    }

    unchangedTimeRef.current = 0;
    setWatching(true);

    intervalRef.current = setInterval(async () => {
      try {
        let newLoc = await Location.getCurrentPositionAsync({});
        if (
          newLoc?.coords &&
          typeof newLoc.coords.latitude === 'number' &&
          typeof newLoc.coords.longitude === 'number'
        ) {
          setLocation(newLoc.coords);

          const distanceMoved =
            Math.abs(newLoc.coords.latitude - lastLocationRef.current.latitude) +
            Math.abs(newLoc.coords.longitude - lastLocationRef.current.longitude);

          if (distanceMoved < 0.0001) {
            unchangedTimeRef.current += 10;
          } else {
            unchangedTimeRef.current = 0;
            lastLocationRef.current = newLoc.coords;
          }

          if (unchangedTimeRef.current >= 60 && countdown === null) {
            triggerAlert(newLoc.coords);
          }
        } else {
          // Optionally alert or log
        }
      } catch (error) {
        Alert.alert('GPS Error', 'Could not fetch updated location.');
      }
    }, 10000);
  };

  const stopTrip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
    setWatching(false);
    unchangedTimeRef.current = 0;
    Alert.alert('Tracking Stopped', 'Alerto trip ended.');
  };

  const triggerAlert = async (coords: any) => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch { }
    Vibration.vibrate([500, 500, 500]);

    if (Device.isDevice) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'No movement detected',
          body: 'Sending SOS in 5 seconds if no action taken.',
        },
        trigger: null,
      });
    }

    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          sendSOS(coords, 'Auto SOS due to no movement');
          setWatching(false);
          return null;
        }
        return prev! - 1;
      });
    }, 1000);

    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    // Voice command listeners
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;

    // Ask mic permission and start listening
    requestMicPermission().then(() => {
      startListening(); // 🔁 Automatically start voice detection
    });

    // Ask for mic permission
    requestMicPermission();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return (
    <ImageBackground source={require('../../assets/background.png')} style={styles.background}>
      <View style={styles.overlay}>
        <Text style={styles.title}>ALERTO!</Text>

        <TouchableOpacity
          style={[styles.button, watching ? styles.disabledButton : styles.startButton]}
          onPress={startTrip}
          disabled={watching}
        >
          <Text style={styles.buttonText}>Start Trip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.stopButton]}
          onPress={stopTrip}
          disabled={!watching}
        >
          <Text style={styles.buttonText}>Stop Trip</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.sosButton]} onPress={manualSOS}>
          <Text style={styles.buttonText}>SOS Now</Text>
        </TouchableOpacity>

        <View style={{ width: '100%', marginTop: 20 }}>
          <Text style={{ color: '#bbb', fontSize: 14, textAlign: 'center' }}>
            {location
              ? `📍 Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}`
              : '📍 Waiting for location...'}
          </Text>
        </View>
        {countdown !== null && (
          <Text style={styles.countdownText}>Auto SOS in {countdown}...</Text>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
    justifyContent: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(15, 15, 15, 0.7)',
    padding: 20,
    borderRadius: 8,
    marginHorizontal: 40,
    height: "45%",
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  title: {
    fontSize: 28,
    color: '#d0d0d0',
    fontWeight: 'bold',
    marginBottom: 20,
    letterSpacing: 1,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 4,
    marginVertical: 10,
    width: '60%',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  startButton: {
    backgroundColor: '#5a7edc',
  },
  stopButton: {
    backgroundColor: '#5a7edc',
  },
  sosButton: {
    backgroundColor: '#5a7edc',
  },
  disabledButton: {
    backgroundColor: '#808080',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  text: {
    marginTop: 60,
    color: '#bbb',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  countdownText: {
    marginTop: 10,
    fontSize: 16,
    color: '#ff4444',
    fontWeight: 'bold',
  },
});