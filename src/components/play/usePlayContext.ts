import { getCurrentUser, getUserName } from "@/lib/auth";
import { getMyCouple } from "@/lib/couples";
import { getSpicyState, type SpicyState } from "@/lib/play";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export type PlayContext = {
  myId: string;
  coupleId: string;
  partnerId: string | null;
  partnerName: string;
  spicy: SpicyState;
};

// Who we are + spicy state, refreshed whenever a Play screen gains focus.
export function usePlayContext() {
  const [ctx, setCtx] = useState<PlayContext | null>(null);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const couple = await getMyCouple();
      if (!couple) return;
      const partnerId = couple.partner_one === user.id ? couple.partner_two : couple.partner_one;
      const [name, spicy] = await Promise.all([
        partnerId ? getUserName(partnerId).catch(() => null) : Promise.resolve(null),
        getSpicyState(couple.id, user.id).catch(() => ({ mine: false, partner: false, on: false })),
      ]);
      setCtx({
        myId: user.id,
        coupleId: couple.id,
        partnerId: partnerId ?? null,
        partnerName: name?.trim().split(/\s+/)[0] ?? "your person",
        spicy,
      });
    } catch (e: any) {
      console.log("[Play] context failed:", e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { ctx, reload: load };
}
