import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const base = 'flex-row items-center justify-center rounded-lg py-3 px-6';
  const variants = {
    primary: 'bg-accent',
    secondary: 'bg-cream-dark border border-ruled-line',
    ghost: 'bg-transparent',
    danger: 'bg-red-500',
  };
  const textVariants = {
    primary: 'text-white font-semibold text-base',
    secondary: 'text-ink font-medium text-base',
    ghost: 'text-ink-light text-base',
    danger: 'text-white font-semibold text-base',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${disabled || loading ? 'opacity-50' : ''} ${className}`}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'ghost' ? '#2C2C2C' : '#ffffff'}
          size="small"
        />
      ) : (
        <Text className={textVariants[variant]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
