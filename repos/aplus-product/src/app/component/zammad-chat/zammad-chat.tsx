"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { ROUTE } from "@/app/constant/route";
import { useSession } from "@/app/component/auth-provider/auth-provider";

const ZAMMAD_BASE =
  "https://administration-plus-zammad.anct.cloud-ed.fr/assets/chat";
const ZAMMAD_JS = `${ZAMMAD_BASE}/chat.min.js`;
const JQUERY_URL = "https://code.jquery.com/jquery-3.6.0.min.js";

interface ZammadChatInstance {
  destroy?: () => void;
}

declare global {
  interface Window {
    jQuery: (callback: () => void) => void;
    ZammadChat: new (options: {
      fontSize: string;
      chatId: number;
    }) => ZammadChatInstance;
  }
}

export function ZammadChat() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [scriptsReady, setScriptsReady] = useState(false);
  const instanceRef = useRef<ZammadChatInstance | null>(null);

  const shouldShow =
    pathname === ROUTE.CONTACT && !isPending && Boolean(session?.user);

  useEffect(() => {
    if (!shouldShow || !scriptsReady) {
      return;
    }

    if (!window.jQuery || !window.ZammadChat) {
      return;
    }

    window.jQuery(() => {
      instanceRef.current = new window.ZammadChat({
        fontSize: "12px",
        chatId: 1,
      });
    });

    return () => {
      instanceRef.current?.destroy?.();
      instanceRef.current = null;

      document
        .querySelectorAll(
          ".zammad-chat, .zammad-chat-modal, .zammad-chat-modal-backdrop",
        )
        .forEach((el) => el.remove());
    };
  }, [shouldShow, scriptsReady]);

  if (!shouldShow) {
    return null;
  }

  return (
    <>
      <Script src={JQUERY_URL} strategy="afterInteractive" />
      <Script
        src={ZAMMAD_JS}
        strategy="afterInteractive"
        onLoad={() => setScriptsReady(true)}
      />
    </>
  );
}
