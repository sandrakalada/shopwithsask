import { Fragment } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { IntroScene } from "./IntroScene";
import { OutroScene } from "./OutroScene";
import { ProductScene } from "./ProductScene";
import { products } from "./products";

export const INTRO = 60;
export const PRODUCT = 75;
export const OUTRO = 105;
export const TRANSITION = 12;

export const REEL_DURATION =
  INTRO + products.length * PRODUCT + OUTRO - (products.length + 1) * TRANSITION;

const timing = linearTiming({ durationInFrames: TRANSITION });

export const Reel: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Intro" durationInFrames={INTRO}>
      <IntroScene />
    </TransitionSeries.Sequence>
    {products.map((product, i) => (
      <Fragment key={product.image}>
        <TransitionSeries.Transition
          presentation={i === 0 ? fade() : slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence name={product.title} durationInFrames={PRODUCT}>
          <ProductScene product={product} />
        </TransitionSeries.Sequence>
      </Fragment>
    ))}
    <TransitionSeries.Transition presentation={fade()} timing={timing} />
    <TransitionSeries.Sequence name="Outro" durationInFrames={OUTRO}>
      <OutroScene />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
