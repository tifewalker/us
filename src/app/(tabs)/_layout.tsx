import { TabBar } from "@/components/tab-bar";
import { useAuth } from "@/hooks/useAuth";
import { usePushLifecycle } from "@/hooks/usePushLifecycle";
import { getMyCouple } from "@/lib/couples";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/tabs";
import { useEffect, useState } from "react";

export default function TabsLayout() {
  const { session, loading: authLoading } = useAuth();
  const [checkedForUserId, setCheckedForUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<any>(null);

  useEffect(() => {
    if (!session) {
      setCheckedForUserId(null);
      setCouple(null);
      return;
    }
    getMyCouple()
      .then((c) => {
        setCouple(c);
        setCheckedForUserId(session.user.id);
      })
      .catch(() => {
        setCouple(null);
        setCheckedForUserId(session.user.id);
      });
  }, [session]);

  // web push + timezone / last seen, once we know this user is paired
  usePushLifecycle(!!session && !!couple && checkedForUserId === session.user.id);

  if (authLoading) return null;

  if (!session) {
    return <Redirect href="/welcome" />;
  }

  // We have a session, but haven't finished checking THIS user's couple yet —
  // render nothing rather than risk a decision based on stale/previous state.
  if (checkedForUserId !== session.user.id) return null;

  if (!couple) {
    return <Redirect href="/pairing-choice" />;
  }

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="story" />
      <Tabs.Screen name="us" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
