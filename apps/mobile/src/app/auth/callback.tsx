import { useEffect, useRef } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useTranslations } from "use-intl";
import { completeFromUrl } from "~/lib/auth";
import { toast } from "~/components/ui/toast";
import { useColors } from "~/theme/theme";

/**
 * Where an emailed confirmation link lands (`cigua://auth/callback?code=…`). The
 * code is exchanged once; the session change then routes the app on its own.
 */
export default function AuthCallback() {
  const c = useColors();
  const t = useTranslations("Login");
  const params = useLocalSearchParams<{ code?: string }>();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const url = Linking.createURL("auth/callback", { queryParams: params.code ? { code: params.code } : {} });
    void completeFromUrl(url).then(({ error }) => {
      if (error) toast.error(t("linkError"));
      router.replace("/");
    });
  }, [params.code, t]);

  return <View style={{ flex: 1, backgroundColor: c.background }} />;
}
