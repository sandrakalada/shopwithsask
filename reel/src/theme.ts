import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const serif = "Playfair Display";
export const sans = "Cairo";

const ARABIC = "U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FE74";

loadFont({ family: serif, url: staticFile("fonts/playfair-600.woff2"), weight: "600" });
for (const weight of ["500", "700"]) {
  loadFont({ family: sans, url: staticFile("fonts/cairo-latin.woff2"), weight });
  loadFont({ family: sans, url: staticFile("fonts/cairo-arabic.woff2"), weight, unicodeRange: ARABIC });
}

export const colors = {
  cream: "#F4EEE6",
  ink: "#1E1A17",
  caramel: "#A8703F",
};

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
