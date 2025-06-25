// REACT & REACT NATIVE
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Alert, Vibration,
  TouchableOpacity, TextInput, ImageBackground,
  Platform, PermissionsAndroid,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

// LIBS
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Voice from '@react-native-voice/voice';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

// KEYS & ENDPOINTS
const ORS_API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY'; // replace with your actual key
const SOS_ENDPOINT = 'http://192.168.29.116:3000/api/trigger-sos';

export default function HomeScreen() {
  const [location, setLocation] = useState<any>(null);
  const [watching, setWatching] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [mapMode, setMapMode] = useState(false);
  const [destinationInput, setDestinationInput] = useState('');
  const [destination, setDestination] = useState<any>(null);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [expectedRoute, setExpectedRoute] = useState<any[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<string[]>([]);

  const lastLocationRef = useRef<any>(null);
  const unchangedTimeRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('emergency_contacts');
      if (saved) setEmergencyContacts(JSON.parse(saved));
    })();
  }, []);

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

  const fetchORSRoute = async (start: any, end: any) => {
    try {
      const res = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          coordinates: [
            [start.longitude, start.latitude],
            [end.longitude, end.latitude],
          ],
        },
        {
          headers: {
            Authorization: ORS_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const coords = res.data.features[0].geometry.coordinates.map(
        ([lon, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lon,
        })
      );
      setRouteCoords(coords);
      setExpectedRoute(coords);
    } catch (err) {
      Alert.alert('Route Error', 'Failed to fetch route.');
      console.error(err);
    }
  };

  useEffect(() => {
    if (location && destination) {
      fetchORSRoute(location, destination);
    }
  }, [location, destination]);

  const searchDestinationByName = async () => {
    if (!destinationInput.trim()) return;
    try {
      const res = await axios.get(
        `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(destinationInput)}`
      );
      const place = res.data.features[0];
      if (place) {
        const [lon, lat] = place.geometry.coordinates;
        const coords = { latitude: lat, longitude: lon };
        setDestination(coords);
        fetchORSRoute(location, coords);
      } else {
        Alert.alert('Not Found', 'No location found for that name.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to search destination');
    }
  };

  const startListening = async () => {
    try {
      await Voice.start('en-US');
    } catch (e) {
      console.error('Voice start error:', e);
    }
  };

  const onSpeechResults = (e: any) => {
    const spoken = e.value[0]?.toLowerCase() || '';
    if (spoken.includes('help') || spoken.includes('sos') || spoken.includes('emergency')) {
      manualSOS();
    }
  };

  const manualSOS = async () => {
    let loc = location;
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
      try {
        const latestLoc = await Location.getCurrentPositionAsync({});
        loc = latestLoc.coords;
        setLocation(loc);
      } catch {
        Alert.alert('Location Error', 'Could not get location for SOS.');
        return;
      }
    }
    await sendSOS(loc, 'Manual SOS triggered by user or sensor');
  };

  const sendSOS = async (loc: any, notes: string) => {
    if (emergencyContacts.length === 0) {
      Alert.alert('No Contacts', 'Please add emergency contacts first.');
      return;
    }
    try {
      await axios.post(SOS_ENDPOINT, {
        name: 'Test User',
        lat: loc.latitude,
        lon: loc.longitude,
        contacts: emergencyContacts,
        notes,
      });
      Alert.alert('SOS Sent', 'Message sent to all contacts.');
    } catch (error) {
      Alert.alert('SOS Failed', 'Could not send SOS.');
    }
  };

  const startTrip = async () => {
    if (!destination) {
      Alert.alert('Missing Destination', 'Please set a destination before starting trip.');
      return;
    }

    setExpectedRoute(routeCoords);

    intervalRef.current = setInterval(async () => {
      let newLoc = await Location.getCurrentPositionAsync({});

      if (expectedRoute.length > 0) {
        const onRoute = expectedRoute.some((point) => {
          const dist = getDistanceInMeters(point, newLoc.coords);
          return dist <= 10;
        });

        if (!onRoute) {
          Alert.alert('⚠️ Off Route', 'You have deviated more than 10m from the path!');
        }
      }
    }, 5000);

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Error', 'Permission to access location was denied');
      return;
    }

    let loc = await Location.getCurrentPositionAsync({});
    if (loc?.coords) {
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
        if (newLoc?.coords) {
          setLocation(newLoc.coords);
          const moved =
            Math.abs(newLoc.coords.latitude - lastLocationRef.current.latitude) +
            Math.abs(newLoc.coords.longitude - lastLocationRef.current.longitude);
          if (moved < 0.0001) unchangedTimeRef.current += 10;
          else {
            unchangedTimeRef.current = 0;
            lastLocationRef.current = newLoc.coords;
          }

          if (unchangedTimeRef.current >= 60 && countdown === null) {
            triggerAlert(newLoc.coords);
          }
        }
      } catch {
        Alert.alert('GPS Error', 'Could not fetch updated location.');
      }
    }, 10000);
  };

  const stopTrip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
    setWatching(false);
    setDestination(null);
    setDestinationInput('');
    setRouteCoords([]);
    setMapMode(false);
    unchangedTimeRef.current = 0;
    Alert.alert('Tracking Stopped', 'Trip ended.');
  };

  const triggerAlert = async (coords: any) => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
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
          clearInterval(countdownRef.current!);
          sendSOS(coords, 'Auto SOS due to no movement');
          setWatching(false);
          return null;
        }
        return prev! - 1;
      });
    }, 1000);

    clearInterval(intervalRef.current!);
  };

  useEffect(() => {
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = () => setTimeout(() => startListening(), 1000);
    requestMicPermission().then(startListening);

    const accelSub = Accelerometer.addListener(({ x, y, z }) => {
      const totalForce = Math.sqrt(x * x + y * y + z * z);
      if (totalForce > 2.5) manualSOS();
    });

    Accelerometer.setUpdateInterval(300);

    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(countdownRef.current!);
      accelSub.remove();
    };
  }, []);

  return (
    <>
      <TouchableOpacity
        style={[styles.button, { margin: 15, backgroundColor: mapMode ? '#444' : '#5a7edc' }]}
        onPress={() => setMapMode(!mapMode)}
      >
        <Text style={styles.buttonText}>{mapMode ? 'Back to Home' : '🗺️ Open Map View'}</Text>
      </TouchableOpacity>

      {!mapMode ? (
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

            {countdown !== null && (
              <Text style={styles.countdownText}>Auto SOS in {countdown}...</Text>
            )}
          </View>
        </ImageBackground>
      ) : (
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.input}
            placeholder="Search Destination by name"
            value={destinationInput}
            onChangeText={setDestinationInput}
            onSubmitEditing={searchDestinationByName}
          />

          <MapView
            style={{ flex: 1 }}
            showsUserLocation
            onPress={(e) => {
              const coords = e.nativeEvent.coordinate;
              setDestination({
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
            }}
            region={{
              latitude: location?.latitude || 28.6,
              longitude: location?.longitude || 77.2,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {location && <Marker coordinate={location} title="You" />}
            {destination && (
              <Marker coordinate={destination} title="Destination" pinColor="green" />
            )}
            {routeCoords.length > 0 && (
              <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="blue" />
            )}
          </MapView>
        </View>
      )}
    </>
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
    height: '45%',
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
    paddingVertical: 7,
    paddingHorizontal: 25,
    borderRadius: 4,
    marginVertical: 10,
    width: '50%',
    alignSelf: 'center',
  },
  startButton: { backgroundColor: '#5a7edc' },
  stopButton: { backgroundColor: '#5a7edc' },
  sosButton: { backgroundColor: '#5a7edc' },
  disabledButton: { backgroundColor: '#808080' },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  countdownText: {
    marginTop: 10,
    fontSize: 16,
    color: '#ff4444',
    fontWeight: 'bold',
  },
  input: {
    margin: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 10,
  },
});

const getDistanceInMeters = (p1: any, p2: any) => {
  const R = 6371000; // Earth radius in m
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const lat1 = (p1.latitude * Math.PI) / 180;
  const lat2 = (p2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
