export const GAME_REGISTRY = {
  "dustbowl-dash": {
    title: "Dustbowl Dash",
    description: "Infinite runner in the wild west. Go the distance and lasso rabbits!",
    heroImage: "/images/game_icons/dustbowl_dash_game_icon.png",
    carouselIcon: "/images/game_icons/dustbowl_dash_game_icon.png",
    config: {
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
      },
      backgroundColor: "#f4dfb8",
    },
    sceneImporter: async () => {
      const { default: BootScene } = await import("@/games/dustbowl-dash/scenes/BootScene");
      const { default: MainScene } = await import("@/games/dustbowl-dash/scenes/MainScene");
      return [BootScene, MainScene];
    },
  },
  pong: {
    title: "Pong MainScene",
    description: "Classic pong with a twist.",
    heroImage: "/images/game_icons/ping-pong_game_icon.png",
    carouselIcon: "/images/game_icons/ping-pong_game_icon.png",
    config: null,
    sceneImporter: null,
  },
  "pixel-fistfight": {
    title: "Pixel Fistfight",
    description: "Duke it out in pixel art.",
    heroImage: "/images/game_icons/fist_fight_game_icon.png",
    carouselIcon: "/images/game_icons/fist_fight_game_icon.png",
    config: null,
    sceneImporter: null,
  },
  "space-invaders": {
    title: "Space Invaders",
    description: "Defend planet earth.",
    heroImage: "/images/game_icons/space_game_icon.png",
    carouselIcon: "/images/game_icons/space_game_icon.png",
    config: null,
    sceneImporter: null,
  },
  "debug-platformer": {
    title: "Debug Platformer",
    description: "Jump, run, debug.",
    heroImage: "/images/game_icons/platformer_game_icon.png",
    carouselIcon: "/images/game_icons/platformer_game_icon.png",
    config: null,
    sceneImporter: null,
  },
};
