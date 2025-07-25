const { app, Tray, Menu, dialog, shell, nativeImage } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");

class VSCodeTrayLauncher {
  constructor() {
    this.tray = null;
    this.projects = [];
    this.projectsFile = this.getProjectsFilePath();
    this.platform = process.platform;
    this.vscodeCommand = null;

    console.log(`Plataforma detectada: ${this.platform}`);
    this.loadProjects();
    this.findVSCodeCommand();
  }

  getProjectsFilePath() {
    if (app.isPackaged) {
      const userDataPath = app.getPath("userData");
      return path.join(userDataPath, "projects.json");
    }
    return path.join(__dirname, "projects.json");
  }

  async findVSCodeCommand() {
    console.log("Procurando VS Code...");

    const possibleCommands = [];

    if (this.platform === "win32") {
      possibleCommands.push(
        "code",
        "code.cmd",
        path.join(
          process.env.LOCALAPPDATA || "",
          "Programs",
          "Microsoft VS Code",
          "bin",
          "code.cmd"
        ),
        path.join(
          process.env.PROGRAMFILES || "",
          "Microsoft VS Code",
          "bin",
          "code.cmd"
        ),
        path.join(
          process.env["PROGRAMFILES(X86)"] || "",
          "Microsoft VS Code",
          "bin",
          "code.cmd"
        )
      );
    } else {
      possibleCommands.push(
        "code",
        "/usr/bin/code",
        "/usr/local/bin/code",
        "/snap/bin/code"
      );
    }

    for (const cmd of possibleCommands) {
      if (await this.testVSCodeCommand(cmd)) {
        this.vscodeCommand = cmd;
        console.log(`VS Code encontrado: ${cmd}`);
        return;
      }
    }

    console.log("VS Code não encontrado em nenhum local padrão");
    this.vscodeCommand = null;
  }

  testVSCodeCommand(command) {
    return new Promise((resolve) => {
      if (fs.existsSync(command)) {
        resolve(true);
        return;
      }

      exec(`"${command}" --version`, { timeout: 5000 }, (error) => {
        resolve(!error);
      });
    });
  }

  loadProjects() {
    try {
      if (fs.existsSync(this.projectsFile)) {
        const data = fs.readFileSync(this.projectsFile, "utf8");
        this.projects = JSON.parse(data);
        console.log(`${this.projects.length} projetos carregados`);
      } else {
        this.projects = [];
        console.log("Nenhum projeto encontrado, iniciando lista vazia");
      }
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      this.projects = [];
    }
  }

  saveProjects() {
    try {
      const dir = path.dirname(this.projectsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.projectsFile,
        JSON.stringify(this.projects, null, 2)
      );
      console.log("Projetos salvos com sucesso");
    } catch (error) {
      console.error("Erro ao salvar projetos:", error);
    }
  }

  async addProject() {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Selecione a pasta do projeto",
        buttonLabel: "Adicionar Projeto",
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const projectPath = result.filePaths[0];
        const projectName = path.basename(projectPath);

        const existingProject = this.projects.find(
          (p) => p.path === projectPath
        );
        if (existingProject) {
          dialog.showMessageBox({
            type: "warning",
            title: "Projeto já existe",
            message: `O projeto "${projectName}" já está na lista!`,
          });
          return;
        }

        const newProject = {
          name: projectName,
          path: projectPath,
          addedAt: new Date().toISOString(),
        };

        this.projects.push(newProject);
        this.saveProjects();
        this.updateTrayMenu();

        console.log(`Projeto '${projectName}' adicionado!`);
      }
    } catch (error) {
      console.error("Erro ao adicionar projeto:", error);
      dialog.showErrorBox("Erro", "Não foi possível adicionar o projeto");
    }
  }

  removeProject(index) {
    try {
      const project = this.projects[index];
      if (!project) return;

      // Remove sem confirmação
      this.projects.splice(index, 1);
      this.saveProjects();
      this.updateTrayMenu();
      console.log(`Projeto '${project.name}' removido!`);
    } catch (error) {
      console.error("Erro ao remover projeto:", error);
    }
  }

  async openProject(projectPath) {
    try {
      console.log(`Tentando abrir projeto em nova janela: ${projectPath}`);

      if (!this.vscodeCommand) {
        await this.findVSCodeCommand();
      }

      if (!this.vscodeCommand) {
        dialog.showErrorBox(
          "VS Code não encontrado",
          "VS Code não está instalado ou não foi encontrado.\n\nInstale o VS Code ou adicione-o ao PATH do sistema."
        );
        return;
      }

      console.log(`Usando comando: ${this.vscodeCommand}`);

      // Sempre abre em nova janela
      const args = ["--new-window", projectPath];

      const child = spawn(this.vscodeCommand, args, {
        detached: true,
        stdio: "ignore",
        shell: this.platform === "win32",
      });

      child.on("error", (error) => {
        console.error("Erro ao executar VS Code:", error);
        dialog.showErrorBox(
          "Erro",
          `Não foi possível abrir o VS Code:\n${error.message}`
        );
      });

      child.unref();
      console.log(`Projeto aberto em nova janela: ${projectPath}`);
    } catch (error) {
      console.error("Erro ao abrir projeto:", error);
      dialog.showErrorBox(
        "Erro",
        `Não foi possível abrir o projeto:\n${error.message}`
      );
    }
  }

  createTrayMenu() {
    const menuItems = [];

    // Header
    menuItems.push({
      label: "VS Code Tray",
      enabled: false,
    });

    // Lista dos projetos
    if (this.projects.length > 0) {
      menuItems.push({ type: "separator" });

      // Ordena projetos alfabeticamente
      const sortedProjects = [...this.projects].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );

      // Adiciona cada projeto com submenu
      sortedProjects.forEach((project) => {
        const originalIndex = this.projects.findIndex(
          (p) => p.path === project.path
        );

        menuItems.push({
          label: project.name,
          submenu: [
            {
              label: "Abrir no VS Code",
              click: () => this.openProject(project.path),
            },
            { type: "separator" },
            {
              label: "Remover projeto",
              click: () => this.removeProject(originalIndex),
            },
          ],
        });
      });
    } else {
      menuItems.push({ type: "separator" });
      menuItems.push({
        label: "Nenhum projeto adicionado",
        enabled: false,
      });
    }

    // Opções de gerenciamento
    menuItems.push(
      { type: "separator" },
      {
        label: "Adicionar Projeto",
        click: () => this.addProject(),
      },
      { type: "separator" },
      {
        label: "Sair",
        click: () => this.quit(),
      }
    );

    return Menu.buildFromTemplate(menuItems);
  }

  updateTrayMenu() {
    if (this.tray) {
      this.tray.setContextMenu(this.createTrayMenu());
    }
  }

  getTrayIcon() {
    const iconPath = this.getTrayIconPath();

    if (fs.existsSync(iconPath)) {
      try {
        let icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          console.log("Ícone personalizado carregado");
          return icon;
        }
      } catch (error) {
        console.error("Erro ao carregar ícone personalizado:", error);
      }
    }

    console.log("Usando ícone padrão");
    return this.createDefaultIcon();
  }

  getTrayIconPath() {
    if (this.platform === "win32") {
      return path.join(__dirname, "assets", "icon.ico");
    } else {
      return path.join(__dirname, "assets", "icon.png");
    }
  }

  createDefaultIcon() {
    try {
      const size = 16;
      const channels = 4;
      const buffer = Buffer.alloc(size * size * channels);

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const index = (y * size + x) * channels;

          if (x === 0 || x === size - 1 || y === 0 || y === size - 1) {
            buffer[index] = 0;
            buffer[index + 1] = 90;
            buffer[index + 2] = 158;
            buffer[index + 3] = 255;
          } else {
            buffer[index] = 0;
            buffer[index + 1] = 122;
            buffer[index + 2] = 204;
            buffer[index + 3] = 255;
          }
        }
      }

      return nativeImage.createFromBuffer(buffer, {
        width: size,
        height: size,
      });
    } catch (error) {
      console.error("Erro ao criar ícone padrão:", error);
      return nativeImage.createEmpty();
    }
  }

  createTray() {
    const icon = this.getTrayIcon();

    this.tray = new Tray(icon);
    this.tray.setToolTip("VS Code Tray");
    this.tray.setContextMenu(this.createTrayMenu());

    this.tray.on("click", () => {
      this.tray.popUpContextMenu();
    });

    this.tray.on("right-click", () => {
      this.tray.popUpContextMenu();
    });

    this.tray.on("double-click", () => {
      this.addProject();
    });

    console.log("Tray criada com sucesso");
  }

  quit() {
    console.log("Encerrando VS Code Tray Launcher...");
    if (this.tray) {
      this.tray.destroy();
    }
    app.quit();
  }

  init() {
    app.setAppUserModelId("com.vscode.tray.launcher");

    app.whenReady().then(() => {
      this.createTray();
      console.log("VS Code Tray Launcher iniciado!");
      console.log(`Projetos salvos em: ${this.projectsFile}`);
    });

    app.on("window-all-closed", (e) => {
      e.preventDefault();
    });

    app.on("before-quit", () => {
      if (this.tray) {
        this.tray.destroy();
      }
    });

    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
    }
  }
}

const launcher = new VSCodeTrayLauncher();
launcher.init();
