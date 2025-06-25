import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EditContactsScreen() {
  const [contacts, setContacts] = useState<string[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('emergency_contacts');
      if (saved) setContacts(JSON.parse(saved));
    })();
  }, []);

  const saveContacts = async (newContacts: string[]) => {
    setContacts(newContacts);
    try {
      await AsyncStorage.setItem('emergency_contacts', JSON.stringify(newContacts));
      console.log('Saved contacts:', newContacts);
    } catch (e) {
      console.error('Failed to save:', e);
    }
  };

  const addContact = () => {
    if (!input) return;
    if (!/^\+\d{10,15}$/.test(input)) {
      Alert.alert('Invalid number', 'Enter number in +91 format.');
      return;
    }
    const updated = [...contacts, input];
    saveContacts(updated);
    setInput('');
    Alert.alert('Saved', 'Contact added successfully!');
  };

  const removeContact = (num: string) => {
    const updated = contacts.filter((c) => c !== num);
    saveContacts(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Emergency Contacts</Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="+91XXXXXXXXXX"
        keyboardType="phone-pad"
        placeholderTextColor="#888"
      />
      <View style={styles.addButton}>
        <Button title="Add Contact" onPress={addContact} />
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item}
        ListEmptyComponent={<Text style={styles.empty}>No contacts saved.</Text>}
        renderItem={({ item }) => (
          <View style={styles.contactCard}>
            <Text style={styles.contactText}>{item}</Text>
            <Button title="Remove" onPress={() => removeContact(item)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    color: '#000',
  },
  addButton: {
    marginBottom: 20,
  },
  contactCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f3f3',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  contactText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
});
