import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { SocialStackParamList } from '../../navigation/SocialNavigator';

type GroupDetailScreenRouteProp = RouteProp<SocialStackParamList, 'GroupDetail'>;

export const GroupDetailScreen: React.FC = () => {
  const route = useRoute<GroupDetailScreenRouteProp>();
  const navigation = useNavigation();
  const { groupId } = route.params;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Group Details</Text>
        <Text style={styles.description}>Group ID: {groupId}</Text>
      </View>
      
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Back to Groups</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { padding: 24, backgroundColor: '#FFFFFF' },
  title: { fontSize: 24, fontWeight: '700', color: '#000000', marginBottom: 8 },
  description: { fontSize: 15, color: '#8E8E93' },
  button: { margin: 16, backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
