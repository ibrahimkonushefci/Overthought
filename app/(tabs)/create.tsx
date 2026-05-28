import { Redirect } from 'expo-router';

export default function CreateTabFallback() {
  return <Redirect href="/home" />;
}
