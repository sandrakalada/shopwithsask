import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, sans, serif } from "./theme";

const lines = [
  { en: "Cash on delivery or Instapay", ar: "الدفع كاش عند الاستلام أو إنستاباي" },
  { en: "Delivery across Egypt", ar: "توصيل لكل مصر" },
];

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.ink,
        color: colors.cream,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "0 80px",
      }}
    >
      <div style={{ fontFamily: serif, fontSize: 104, opacity: pop(0), transform: `scale(${0.9 + pop(0) * 0.1})` }}>
        Shop now
      </div>
      <div dir="rtl" style={{ fontFamily: sans, fontWeight: 700, fontSize: 88, opacity: pop(6) }}>
        تسوّقي دلوقتي
      </div>
      <div
        style={{
          fontFamily: sans,
          fontWeight: 700,
          fontSize: 64,
          color: colors.cream,
          backgroundColor: colors.caramel,
          borderRadius: 999,
          padding: "12px 56px",
          margin: "64px 0 80px",
          opacity: pop(14),
        }}
      >
        shopwithsask.com
      </div>
      {lines.map((l, i) => (
        <div key={l.en} style={{ marginBottom: 40, opacity: pop(24 + i * 8) }}>
          <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 46 }}>{l.en}</div>
          <div dir="rtl" style={{ fontFamily: sans, fontWeight: 500, fontSize: 46 }}>
            {l.ar}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
