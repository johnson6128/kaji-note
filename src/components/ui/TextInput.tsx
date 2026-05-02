import { View, Text, TextInput as RNTextInput, TextInputProps } from 'react-native';

interface StyledTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function StyledTextInput({ label, error, className = '', ...props }: StyledTextInputProps) {
  return (
    <View className="mb-4">
      {label ? <Text className="text-ink-light text-sm mb-1">{label}</Text> : null}
      <RNTextInput
        className={`bg-white border rounded-lg px-4 py-3 text-ink text-base ${
          error ? 'border-red-400' : 'border-ruled-line'
        } ${className}`}
        placeholderTextColor="#A09080"
        {...props}
      />
      {error ? <Text className="text-red-500 text-xs mt-1">{error}</Text> : null}
    </View>
  );
}
