import { useLocalSearchParams, Redirect } from 'expo-router';

export default function ResultRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (!id) {
    return <Redirect href="/home" />;
  }

  return <Redirect href={`/case/${id}`} />;
}
