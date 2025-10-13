import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useStudyGroups } from "../../hooks";

export const CreateGroupScreen: React.FC = () => {
  const navigation = useNavigation();
  const { createGroup } = useStudyGroups();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxMembers, setMaxMembers] = useState("15");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    setCreating(true);
    const success = await createGroup({
      name: name.trim(),
      description: description.trim(),
      settings: {
        isPrivate,
      },
    });

    setCreating(false);

    if (success) {
      Alert.alert("Success", "Study group created!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>Group Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter group name..."
          value={name}
          onChangeText={setName}
          maxLength={50}
        />
        <Text style={styles.hint}>{name.length}/50 characters</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What is this group about?"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={200}
        />
        <Text style={styles.hint}>{description.length}/200 characters</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.label}>Private Group</Text>
            <Text style={styles.settingDescription}>
              Only invited members can join
            </Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Max Members</Text>
        <TextInput
          style={styles.input}
          placeholder="15"
          value={maxMembers}
          onChangeText={setMaxMembers}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={styles.hint}>Maximum: 15 members</Text>
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          Study groups are a Premium feature. You'll be able to chat with
          members and share progress.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.createButton, creating && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={creating}
      >
        <Text style={styles.createButtonText}>
          {creating ? "Creating..." : "Create Study Group"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: "#000000",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingDescription: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 4,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#E8F4FF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: "#007AFF",
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 32,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
