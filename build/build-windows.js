const builder = require("electron-builder");

builder
  .build({
    targets: builder.Platform.WINDOWS.createTarget(
      ["nsis", "portable"],
      builder.Arch.x64
    ),
    config: {
      win: {
        icon: "assets/icon.ico",
        target: [
          {
            target: "nsis",
            arch: ["x64"],
          },
          {
            target: "portable",
            arch: ["x64"],
          },
        ],
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: false,
        createStartMenuShortcut: true,
        runAfterFinish: true,
      },
    },
  })
  .then(() => {
    console.log("✅ Build Windows concluído!");
  })
  .catch((error) => {
    console.error("❌ Erro no build Windows:", error);
  });
