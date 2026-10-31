"use client";

import { heroScenes, type HeroSceneId } from "./hero-scenes";

export function HeroScene({ sceneId }: { sceneId: HeroSceneId }) {
  const SceneComponent = heroScenes[sceneId];
  if (!SceneComponent) {
    return (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] opacity-30 rounded-3xl" />
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
          Visual placeholder
        </div>
      </>
    );
  }
  return <SceneComponent />;
}
