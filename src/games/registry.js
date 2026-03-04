export const GAME_REGISTRY = {
  "dustbowl-dash": {
    title: "Dustbowl Dash",
    description: "Infinite runner in the wild west. Go the distance and lasso rabbits!",
    heroImage: "/assets/carousel/dustbowl-dash.png",
    carouselIcon: "/assets/carousel/dustbowl-dash.png",
    config: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
      },
    },
    sceneImporter: async () => {
      const { BootScene } = await import("@/games/dustbowl-dash/scenes/BootScene");
      const { MainScene } = await import("@/games/dustbowl-dash/scenes/MainScene");
      return [BootScene, MainScene];
    },
  },
  pong: {
    title: "Pong MainScene",
    description: "Classic pong with a twist.",
    heroImage: "/assets/carousel/pong.png",
    carouselIcon: "/assets/carousel/pong.png",
    config: null,
    sceneImporter: null,
  },
  "pixel-fistfight": {
    title: "Pixel Fistfight",
    description: "Duke it out in pixel art.",
    heroImage: "/assets/carousel/pixel-fistfight.png",
    carouselIcon: "/assets/carousel/pixel-fistfight.png",
    config: null,
    sceneImporter: null,
  },
  "space-invaders": {
    title: "Space Invaders",
    description: "Defend planet earth.",
    heroImage: "/assets/carousel/space-invaders.png",
    carouselIcon: "/assets/carousel/space-invaders.png",
    config: null,
    sceneImporter: null,
  },
  "debug-platformer": {
    title: "Debug Platformer",
    description: "Jump, run, debug.",
    heroImage: "/assets/carousel/debug-platformer.png",
    carouselIcon: "/assets/carousel/debug-platformer.png",
    config: null,
    sceneImporter: null,
  },
};
