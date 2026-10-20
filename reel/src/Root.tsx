import { Composition, Folder } from "remotion";
import { IntroScene } from "./IntroScene";
import { OutroScene } from "./OutroScene";
import { ProductScene } from "./ProductScene";
import { products } from "./products";
import { INTRO, OUTRO, PRODUCT, Reel, REEL_DURATION } from "./Reel";
import { FPS, HEIGHT, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Reel-Scenes">
        <Composition id="Intro" component={IntroScene} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={INTRO} />
        <Composition
          id="Product"
          component={ProductScene}
          width={WIDTH}
          height={HEIGHT}
          fps={FPS}
          durationInFrames={PRODUCT}
          defaultProps={{ product: products[0] }}
        />
        <Composition id="Outro" component={OutroScene} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={OUTRO} />
      </Folder>
      <Composition id="NewCollectionReel" component={Reel} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={REEL_DURATION} />
    </>
  );
};
