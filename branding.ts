import { useEffect, useState } from "react";

import dccLogo from "@/assets/dcc-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_LOGO_URL = dccLogo.url;
const LOGO_KEY = "logo_url";
const LOGO_EVENT = "dcc:logo-updated";

let cachedLogo: string | null = null;

/** Returns the current site logo (admin-uploaded when set, otherwise the DCC seal). */
export function useSiteLogo() {
  const [logo, setLogo] = useState<string>(cachedLogo ?? DEFAULT_LOGO_URL);

  useEffect(() => {
    let active = true;

    void supabase
      .from("app_settings")
      .select("value")
      .eq("key", LOGO_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const value = data?.value;
        if (value) {
          cachedLogo = value;
          setLogo(value);
        }
      });

    const onUpdate = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (next) setLogo(next);
    };
    window.addEventListener(LOGO_EVENT, onUpdate);
    return () => {
      active = false;
      window.removeEventListener(LOGO_EVENT, onUpdate);
    };
  }, []);

  return logo;
}

/** Downscales a picked image file to a small square PNG data URL. */
export function fileToLogoDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a valid image."));
      img.onload = () => {
        const scale = Math.min(size / img.width, size / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process that image."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Saves the logo for the whole site and notifies open screens. */
export async function saveSiteLogo(dataUrl: string) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: LOGO_KEY, value: dataUrl, updated_at: new Date().toISOString() });
  if (error) throw error;
  cachedLogo = dataUrl;
  window.dispatchEvent(new CustomEvent(LOGO_EVENT, { detail: dataUrl }));
}
