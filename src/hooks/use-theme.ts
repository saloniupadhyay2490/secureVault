import { useAppTheme } from '@/context/theme-context';

export function useTheme() {
  const { colors } = useAppTheme();
  return colors;
}
