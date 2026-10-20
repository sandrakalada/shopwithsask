import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Product } from "./products";
import { colors, sans, serif } from "./theme";

export const ProductScene: React.FC<{ product: Product }> = ({ product }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08]);
  const text = spring({ frame: frame - 8, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream, alignItems: "center", color: colors.ink }}>
      <div
        style={{
          marginTop: 120,
          width: 900,
          height: 1200,
          overflow: "hidden",
          borderRadius: 24,
        }}
      >
        <Img
          src={staticFile(product.image)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }}
        />
      </div>
      <div
        style={{
          marginTop: 40,
          textAlign: "center",
          opacity: text,
          transform: `translateY(${(1 - text) * 40}px)`,
        }}
      >
        <div style={{ fontFamily: serif, fontSize: 60, lineHeight: 1.15 }}>{product.title}</div>
        <div dir="rtl" style={{ fontFamily: sans, fontWeight: 700, fontSize: 52, marginTop: 8 }}>
          {product.titleAr}
        </div>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 52, color: colors.caramel, marginTop: 12 }}>
          {product.price.toLocaleString("en-US")} EGP
        </div>
      </div>
    </AbsoluteFill>
  );
};
