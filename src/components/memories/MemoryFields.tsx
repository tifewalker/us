import { SongCard } from "@/components/music/SongCard";
import { SongPicker } from "@/components/music/SongPicker";
import { Button, DatePickerField, Input } from "@/components/ui";
import type { Song } from "@/lib/music";
import { space } from "@/theme";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

export type MemoryFieldValues = {
  title: string;
  description: string;
  location: string;
  date?: Date | null; // shown only when `withDate`
  song?: Song | null;
};

// The memory form fields, shared by "New memory" and "Edit memory".
export function MemoryFields({
  value,
  onChange,
  withDate = false,
}: {
  value: MemoryFieldValues;
  onChange: (v: MemoryFieldValues) => void;
  withDate?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <View style={styles.form}>
      <Input
        label="Title"
        placeholder="The beach where it started"
        value={value.title}
        onChangeText={(title) => onChange({ ...value, title })}
      />
      {withDate && (
        <DatePickerField
          label="When"
          value={value.date ?? null}
          onChange={(date) => onChange({ ...value, date })}
          placeholder="Pick the day"
        />
      )}
      <Input
        label="What happened?"
        placeholder="Write it the way you'd tell it"
        value={value.description}
        onChangeText={(description) => onChange({ ...value, description })}
        multiline
      />
      <Input
        label="Where"
        placeholder="Optional"
        value={value.location}
        onChangeText={(location) => onChange({ ...value, location })}
      />
      {value.song ? (
        <SongCard song={value.song} onRemove={() => onChange({ ...value, song: null })} style={styles.song} />
      ) : (
        <Button title="Add a song" variant="soft" icon="musicalNotes" onPress={() => setPickerOpen(true)} />
      )}
      <SongPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onChoose={(song) => onChange({ ...value, song })} />
    </View>
  );
}

const styles = StyleSheet.create({ form: { marginTop: space.xl }, song: { marginLeft: space.xl } });
