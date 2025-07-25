const { app, Tray, Menu, dialog, shell, nativeImage } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");

class VSCodeTrayLauncher {
  constructor() {
    this.tray = null;
    this.projects = [];
    this.projectsFile = this.getProjectsFilePath();
    this.isDev = process.argv.includes("--dev");
    this.platform = process.platform;

    console.log(`🖥️  Plataforma detectada: ${this.platform}`);
    this.loadProjects();
  }

  getProjectsFilePath() {
    if (app.isPackaged) {
      const userDataPath = app.getPath("userData");
      return path.join(userDataPath, "projects.json");
    }
    return path.join(__dirname, "projects.json");
  }

  loadProjects() {
    try {
      if (fs.existsSync(this.projectsFile)) {
        const data = fs.readFileSync(this.projectsFile, "utf8");
        this.projects = JSON.parse(data);
        console.log(`📁 ${this.projects.length} projetos carregados`);
      } else {
        this.projects = [];
        console.log("📁 Nenhum projeto encontrado, iniciando lista vazia");
      }
    } catch (error) {
      console.error("❌ Erro ao carregar projetos:", error);
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
      console.log("💾 Projetos salvos com sucesso");
    } catch (error) {
      console.error("❌ Erro ao salvar projetos:", error);
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

        // Verifica se já existe
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

        // Detecta informações do projeto
        const projectInfo = this.getProjectInfo(projectPath);

        const newProject = {
          name: projectName,
          path: projectPath,
          type: projectInfo.type,
          framework: projectInfo.framework,
          addedAt: new Date().toISOString(),
        };

        this.projects.push(newProject);
        this.saveProjects();
        this.updateTrayMenu();

        dialog.showMessageBox({
          type: "info",
          title: "Projeto adicionado",
          message: `"${projectName}" foi adicionado com sucesso!`,
        });

        console.log(`✅ Projeto '${projectName}' adicionado!`);
      }
    } catch (error) {
      console.error("❌ Erro ao adicionar projeto:", error);
      dialog.showErrorBox("Erro", "Não foi possível adicionar o projeto");
    }
  }

  getProjectInfo(projectPath) {
    const info = { type: "Projeto", framework: null };

    try {
      // Verifica package.json (Node.js/JavaScript)
      const packageJsonPath = path.join(projectPath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8")
        );
        info.type = "Node.js";

        // Detecta frameworks
        if (packageJson.dependencies || packageJson.devDependencies) {
          const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          if (deps.react) {
            info.framework = "React";
            if (deps.next) info.framework = "Next.js";
          } else if (deps.vue) {
            info.framework = "Vue.js";
            if (deps.nuxt) info.framework = "Nuxt.js";
          } else if (deps["@angular/core"]) {
            info.framework = "Angular";
          } else if (deps.svelte) {
            info.framework = "Svelte";
          } else if (deps.express) {
            info.framework = "Express";
          } else if (deps.electron) {
            info.framework = "Electron";
          }
        }
      }

      // Verifica projetos Python
      else if (
        fs.existsSync(path.join(projectPath, "requirements.txt")) ||
        fs.existsSync(path.join(projectPath, "setup.py")) ||
        fs.existsSync(path.join(projectPath, "pyproject.toml")) ||
        fs.existsSync(path.join(projectPath, "Pipfile"))
      ) {
        info.type = "Python";

        // Detecta frameworks Python
        if (fs.existsSync(path.join(projectPath, "manage.py"))) {
          info.framework = "Django";
        } else if (
          fs.existsSync(path.join(projectPath, "app.py")) ||
          fs.existsSync(path.join(projectPath, "main.py"))
        ) {
          try {
            const reqPath = path.join(projectPath, "requirements.txt");
            if (fs.existsSync(reqPath)) {
              const requirements = fs.readFileSync(reqPath, "utf8");
              if (requirements.includes("flask")) info.framework = "Flask";
              if (requirements.includes("fastapi")) info.framework = "FastAPI";
            }
          } catch (e) {}
        }
      }

      // Verifica projetos .NET
      else if (
        this.findFiles(projectPath, [".csproj", ".sln", ".fsproj", ".vbproj"])
          .length > 0
      ) {
        info.type = ".NET";
      }

      // Verifica projetos Java
      else if (
        fs.existsSync(path.join(projectPath, "pom.xml")) ||
        fs.existsSync(path.join(projectPath, "build.gradle"))
      ) {
        info.type = "Java";
        if (fs.existsSync(path.join(projectPath, "pom.xml")))
          info.framework = "Maven";
        if (fs.existsSync(path.join(projectPath, "build.gradle")))
          info.framework = "Gradle";
      }

      // Verifica projetos Go
      else if (fs.existsSync(path.join(projectPath, "go.mod"))) {
        info.type = "Go";
      }

      // Verifica projetos Rust
      else if (fs.existsSync(path.join(projectPath, "Cargo.toml"))) {
        info.type = "Rust";
      }
    } catch (error) {
      console.log("⚠️  Erro ao detectar tipo do projeto:", error);
    }

    return info;
  }

  findFiles(dir, extensions) {
    try {
      const files = fs.readdirSync(dir);
      return files.filter((file) =>
        extensions.some((ext) => file.endsWith(ext))
      );
    } catch (error) {
      return [];
    }
  }

  removeProject(index) {
    try {
      const project = this.projects[index];
      if (!project) return;

      const response = dialog.showMessageBoxSync({
        type: "question",
        buttons: ["Sim", "Cancelar"],
        defaultId: 1,
        title: "Confirmar remoção",
        message: `Remover "${project.name}" da lista?`,
        detail: "Esta ação não pode ser desfeita.",
      });

      if (response === 0) {
        // Sim
        this.projects.splice(index, 1);
        this.saveProjects();
        this.updateTrayMenu();
        console.log(`🗑️ Projeto '${project.name}' removido!`);
      }
    } catch (error) {
      console.error("❌ Erro ao remover projeto:", error);
    }
  }

  async openProject(projectPath) {
    try {
      // Verifica se o VS Code está instalado
      const isVSCodeInstalled = await this.checkVSCodeInstallation();
      if (!isVSCodeInstalled) {
        dialog.showErrorBox(
          "VS Code não encontrado",
          "VS Code não está instalado ou não está no PATH"
        );
        return;
      }

      // Comando específico por plataforma
      let command, args;

      if (this.platform === "win32") {
        // Windows
        command = "cmd";
        args = ["/c", "code", `"${projectPath}"`];
      } else {
        // Linux
        command = "code";
        args = [projectPath];
      }

      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        shell: this.platform === "win32",
      });

      child.unref();
      console.log(`🚀 Projeto aberto: ${projectPath}`);
    } catch (error) {
      console.error("❌ Erro ao abrir projeto:", error);
      dialog.showErrorBox(
        "Erro",
        "Não foi possível abrir o projeto no VS Code"
      );
    }
  }

  checkVSCodeInstallation() {
    return new Promise((resolve) => {
      let command;

      if (this.platform === "win32") {
        command = "where code";
      } else {
        command = "which code";
      }

      exec(command, (error) => {
        resolve(!error);
      });
    });
  }

  openProjectFolder(projectPath) {
    try {
      shell.openPath(projectPath);
    } catch (error) {
      console.error("❌ Erro ao abrir pasta:", error);
    }
  }

  getProjectIcon(project) {
    if (project.framework) {
      const frameworkIcons = {
        React: "⚛️",
        "Next.js": "▲",
        "Vue.js": "💚",
        "Nuxt.js": "💚",
        Angular: "🅰️",
        Svelte: "🧡",
        Express: "🚂",
        Electron: "⚡",
        Django: "🐍",
        Flask: "🌶️",
        FastAPI: "⚡",
        Maven: "☕",
        Gradle: "🐘",
      };
      return (
        frameworkIcons[project.framework] || this.getTypeIcon(project.type)
      );
    }

    return this.getTypeIcon(project.type);
  }

  getTypeIcon(projectType) {
    const typeIcons = {
      "Node.js": "💚",
      Python: "🐍",
      ".NET": "💙",
      Java: "☕",
      Go: "🐹",
      Rust: "🦀",
      Projeto: "📁",
    };
    return typeIcons[projectType] || "��";
  }

  createTrayMenu() {
    const menuItems = [];

    // Header
    menuItems.push({
      label: "🚀 VS Code Launcher",
      enabled: false,
    });

    // Lista direta dos projetos
    if (this.projects.length > 0) {
      menuItems.push({ type: "separator" });

      // Ordena projetos alfabeticamente
      const sortedProjects = [...this.projects].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );

      // Mostra até 15 projetos diretamente no menu
      const projectsToShow = sortedProjects.slice(0, 15);

      projectsToShow.forEach((project) => {
        const originalIndex = this.projects.findIndex(
          (p) => p.path === project.path
        );
        const label = project.framework
          ? `${this.getProjectIcon(project)} ${project.name} (${
              project.framework
            })`
          : `${this.getProjectIcon(project)} ${project.name}`;

        menuItems.push({
          label: label,
          // Clique esquerdo: abre no VS Code
          click: () => this.openProject(project.path),
          // Submenu para clique direito
          submenu: [
            {
              label: "📁 Abrir pasta",
              click: () => this.openProjectFolder(project.path),
            },
            {
              label: "🗑️ Remover",
              click: () => this.removeProject(originalIndex),
            },
          ],
        });
      });

      // Se há mais de 15 projetos, adiciona submenu "Mais projetos"
      if (this.projects.length > 15) {
        const remainingProjects = sortedProjects.slice(15);

        menuItems.push({
          label: `📂 Mais projetos (${remainingProjects.length})`,
          submenu: remainingProjects.map((project) => {
            const originalIndex = this.projects.findIndex(
              (p) => p.path === project.path
            );
            const label = project.framework
              ? `${this.getProjectIcon(project)} ${project.name} (${
                  project.framework
                })`
              : `${this.getProjectIcon(project)} ${project.name}`;

            return {
              label: label,
              click: () => this.openProject(project.path),
              submenu: [
                {
                  label: "📁 Abrir pasta",
                  click: () => this.openProjectFolder(project.path),
                },
                {
                  label: "🗑️ Remover",
                  click: () => this.removeProject(originalIndex),
                },
              ],
            };
          }),
        });
      }
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
        label: "➕ Adicionar Projeto",
        click: () => this.addProject(),
      },
      { type: "separator" },
      {
        label: "🔄 Recarregar",
        click: () => {
          this.loadProjects();
          this.updateTrayMenu();
        },
      },
      {
        label: "❌ Sair",
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
    // Primeiro tenta carregar o ícone personalizado
    const iconPath = this.getTrayIconPath();

    console.log(`🔍 Tentando carregar ícone: ${iconPath}`);
    console.log(`📁 Arquivo existe: ${fs.existsSync(iconPath)}`);

    if (fs.existsSync(iconPath)) {
      try {
        let icon = nativeImage.createFromPath(iconPath);

        if (!icon.isEmpty()) {
          console.log("✅ Ícone personalizado carregado com sucesso");
          return icon;
        }
      } catch (error) {
        console.error("❌ Erro ao carregar ícone personalizado:", error);
      }
    }

    // Se não conseguir carregar o personalizado, cria um ícone simples
    console.log("🎨 Criando ícone padrão...");
    return this.createDefaultIcon();
  }

  getTrayIconPath() {
    const iconName = this.platform === "win32" ? "ico.ico" : "icon.png";
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "assets", iconName);
    }
    return path.join(__dirname, "assets", iconName);
  }

  createDefaultIcon() {
    try {
      // Cria um ícone PNG simples de 16x16 usando Buffer
      const size = 16;
      const channels = 4; // RGBA
      const buffer = Buffer.alloc(size * size * channels);

      // Preenche o buffer com um ícone azul simples
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const index = (y * size + x) * channels;

          // Cria uma borda e um interior
          if (x === 0 || x === size - 1 || y === 0 || y === size - 1) {
            // Borda azul escura
            buffer[index] = 0; // R
            buffer[index + 1] = 90; // G
            buffer[index + 2] = 158; // B
            buffer[index + 3] = 255; // A
          } else if (
            (x >= 2 && x <= 5 && y >= 5 && y <= 10) ||
            (x >= 7 && x <= 13 && y >= 5 && y <= 7) ||
            (x >= 7 && x <= 13 && y >= 9 && y <= 10) ||
            (x >= 10 && x <= 13 && y >= 7 && y <= 9)
          ) {
            // Desenha "VS" em branco
            buffer[index] = 255; // R
            buffer[index + 1] = 255; // G
            buffer[index + 2] = 255; // B
            buffer[index + 3] = 255; // A
          } else {
            // Interior azul
            buffer[index] = 0; // R
            buffer[index + 1] = 122; // G
            buffer[index + 2] = 204; // B
            buffer[index + 3] = 255; // A
          }
        }
      }

      const icon = nativeImage.createFromBuffer(buffer, {
        width: size,
        height: size,
      });

      console.log("✅ Ícone padrão criado com sucesso");
      return icon;
    } catch (error) {
      console.error("❌ Erro ao criar ícone padrão:", error);
      // Último recurso: ícone vazio
      return nativeImage.createEmpty();
    }
  }

  createTray() {
    const icon = this.getTrayIcon();

    this.tray = new Tray(icon);
    this.tray.setToolTip("VS Code Project Launcher");

    // Define o menu
    const contextMenu = this.createTrayMenu();
    this.tray.setContextMenu(contextMenu);

    // Eventos do tray - clique simples abre o menu
    this.tray.on("click", () => {
      this.tray.popUpContextMenu(contextMenu);
    });

    this.tray.on("right-click", () => {
      this.tray.popUpContextMenu(contextMenu);
    });

    // Duplo clique para adicionar projeto rapidamente
    this.tray.on("double-click", () => {
      this.addProject();
    });

    console.log("🎯 Tray criada com sucesso");
  }

  quit() {
    console.log("👋 Encerrando VS Code Tray Launcher...");
    if (this.tray) {
      this.tray.destroy();
    }
    app.quit();
  }

  init() {
    // Configurações específicas
    app.setAppUserModelId("com.vscode.tray.launcher");

    app.whenReady().then(() => {
      this.createTray();
      console.log("🚀 VS Code Tray Launcher iniciado!");
      console.log(`🖥️  Plataforma: ${this.platform}`);
      console.log(`�� Projetos salvos em: ${this.projectsFile}`);

      if (this.isDev) {
        console.log("🔧 Modo desenvolvimento ativo");
      }
    });

    // Impede que o app feche
    app.on("window-all-closed", (e) => {
      e.preventDefault();
    });

    // Cleanup
    app.on("before-quit", () => {
      if (this.tray) {
        this.tray.destroy();
      }
    });

    // Instância única
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
    } else {
      app.on("second-instance", () => {
        if (this.tray) {
          this.tray.popUpContextMenu();
        }
      });
    }
  }
}

// Inicia a aplicação
const launcher = new VSCodeTrayLauncher();
launcher.init();
