const builder = require("electron-builder");

builder
  .build({
    targets: builder.Platform.LINUX.createTarget(
      ["AppImage", "deb", "rpm"],
      builder.Arch.x64
    ),
    config: {
      linux: {
        icon: "assets/icon.png",
        target: [
          {
            target: "AppImage",
            arch: ["x64"],
          },
          {
            target: "deb",
            arch: ["x64"],
          },
          {
            target: "rpm",
            arch: ["x64"],
          },
        ],
        category: "Development",
      },
    },
  })
  .then(() => {
    console.log("✅ Build Linux concluído!");
  })
  .catch((error) => {
    console.error("❌ Erro no build Linux:", error);
  });
