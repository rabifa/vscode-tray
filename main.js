const {
  app,
  Tray,
  Menu,
  dialog,
  shell,
  nativeImage,
  Notification,
} = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

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
          this.showNotification(
            "Projeto já existe",
            `O projeto "${projectName}" já está na lista!`
          );
          return;
        }

        // Detecta informações do projeto
        const projectInfo = this.getProjectInfo(projectPath);

        const newProject = {
          name: projectName,
          path: projectPath,
          type: projectInfo.type,
          framework: projectInfo.framework,
          lastOpened: null,
          addedAt: new Date().toISOString(),
          openCount: 0,
        };

        this.projects.push(newProject);
        this.saveProjects();
        this.updateTrayMenu();

        this.showNotification(
          "✅ Projeto adicionado",
          `"${projectName}" foi adicionado com sucesso!`
        );
        console.log(`✅ Projeto '${projectName}' adicionado!`);
      }
    } catch (error) {
      console.error("❌ Erro ao adicionar projeto:", error);
      this.showNotification("❌ Erro", "Não foi possível adicionar o projeto");
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
          // Verifica se tem Flask nas dependências
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

      this.projects.splice(index, 1);
      this.saveProjects();
      this.updateTrayMenu();

      this.showNotification(
        "🗑️ Projeto removido",
        `"${project.name}" foi removido da lista`
      );
      console.log(`🗑️ Projeto '${project.name}' removido!`);
    } catch (error) {
      console.error("❌ Erro ao remover projeto:", error);
    }
  }

  async openProject(projectPath, projectIndex = null) {
    try {
      // Verifica se o VS Code está instalado
      const isVSCodeInstalled = await this.checkVSCodeInstallation();
      if (!isVSCodeInstalled) {
        this.showNotification(
          "❌ VS Code não encontrado",
          "VS Code não está instalado ou não está no PATH"
        );
        return;
      }

      // Atualiza estatísticas
      if (projectIndex !== null) {
        this.projects[projectIndex].lastOpened = new Date().toISOString();
        this.projects[projectIndex].openCount =
          (this.projects[projectIndex].openCount || 0) + 1;
        this.saveProjects();
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
      this.showNotification(
        "❌ Erro",
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

    if (this.projects.length > 0) {
      menuItems.push({ type: "separator" });

      // Projetos mais usados (top 5)
      const mostUsed = [...this.projects]
        .filter((p) => p.openCount > 0)
        .sort((a, b) => b.openCount - a.openCount)
        .slice(0, 5);

      if (mostUsed.length > 0) {
        menuItems.push({
          label: "⭐ Mais Usados",
          enabled: false,
        });

        mostUsed.forEach((project) => {
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
            click: () => this.openProject(project.path, originalIndex),
          });
        });

        menuItems.push({ type: "separator" });
      }

      // Todos os projetos organizados por tipo
      const projectsByType = {};
      this.projects.forEach((project, index) => {
        const type = project.type || "Outros";
        if (!projectsByType[type]) {
          projectsByType[type] = [];
        }
        projectsByType[type].push({ project, index });
      });

      menuItems.push({
        label: "📂 Todos os Projetos",
        submenu: Object.entries(projectsByType).map(([type, projects]) => ({
          label: `${this.getTypeIcon(type)} ${type} (${projects.length})`,
          submenu: projects.map(({ project, index }) => {
            const label = project.framework
              ? `${project.name} (${project.framework})`
              : project.name;

            return {
              label: label,
              submenu: [
                {
                  label: "🚀 Abrir no VS Code",
                  click: () => this.openProject(project.path, index),
                },
                {
                  label: "📁 Abrir pasta",
                  click: () => this.openProjectFolder(project.path),
                },
                { type: "separator" },
                {
                  label: `📍 ${project.path}`,
                  enabled: false,
                },
                {
                  label: `🏷️ Tipo: ${project.type}${
                    project.framework ? ` (${project.framework})` : ""
                  }`,
                  enabled: false,
                },
                {
                  label: `📊 Aberto ${project.openCount || 0} vezes`,
                  enabled: false,
                },
                { type: "separator" },
                {
                  label: "🗑️ Remover",
                  click: () => this.removeProject(index),
                },
              ],
            };
          }),
        })),
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
        label: "➕ Adicionar Projeto",
        click: () => this.addProject(),
      },
      {
        label: "📊 Estatísticas",
        click: () => this.showStats(),
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
        label: "⚙️ Sobre",
        click: () => this.showAbout(),
      },
      { type: "separator" },
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

  showStats() {
    const totalProjects = this.projects.length;
    const usedProjects = this.projects.filter((p) => p.openCount > 0).length;
    const totalOpens = this.projects.reduce(
      (sum, p) => sum + (p.openCount || 0),
      0
    );

    const projectTypes = {};
    this.projects.forEach((p) => {
      const key = p.framework ? `${p.type} (${p.framework})` : p.type;
      projectTypes[key] = (projectTypes[key] || 0) + 1;
    });

    const typesList = Object.entries(projectTypes)
      .map(([type, count]) => `  • ${type}: ${count}`)
      .join("\n");

    const mostUsed = this.projects
      .filter((p) => p.openCount > 0)
      .sort((a, b) => b.openCount - a.openCount)
      .slice(0, 3)
      .map((p) => `  • ${p.name}: ${p.openCount} vezes`)
      .join("\n");

    dialog.showMessageBox({
      type: "info",
      title: "Estatísticas dos Projetos",
      message: "📊 Estatísticas dos Projetos",
      detail: `Total de projetos: ${totalProjects}
Projetos utilizados: ${usedProjects}
Total de aberturas: ${totalOpens}

Tipos de projeto:
${typesList || "  Nenhum projeto"}

Mais utilizados:
${mostUsed || "  Nenhum projeto aberto ainda"}`,
    });
  }

  showAbout() {
    dialog.showMessageBox({
      type: "info",
      title: "Sobre",
      message: "VS Code Tray Launcher",
      detail: `Versão: ${app.getVersion()}
Plataforma: ${this.platform}
Electron: ${process.versions.electron}
Node.js: ${process.versions.node}

Arquivo de projetos:
${this.projectsFile}

Desenvolvido para Windows e Linux`,
    });
  }

  showNotification(title, body) {
    try {
      if (Notification.isSupported()) {
        new Notification({
          title,
          body,
          icon: this.getTrayIconPath(),
        }).show();
      } else if (this.tray && this.platform === "win32") {
        // Fallback para Windows
        this.tray.displayBalloon({
          title,
          content: body,
        });
      }
    } catch (error) {
      console.log("⚠️  Erro ao mostrar notificação:", error);
    }
  }

  getTrayIconPath() {
    const iconName = this.platform === "win32" ? "icon.ico" : "icon.png";
    return path.join(__dirname, "assets", iconName);
  }

  getTrayIcon() {
    const iconPath = this.getTrayIconPath();

    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath);
    }

    // Ícone de fallback
    return nativeImage.createEmpty();
  }

  createTray() {
    const icon = this.getTrayIcon();

    this.tray = new Tray(icon);
    this.tray.setToolTip("VS Code Project Launcher");
    this.tray.setContextMenu(this.createTrayMenu());

    // Eventos específicos por plataforma
    if (this.platform === "win32") {
      // Windows: duplo clique para adicionar projeto
      this.tray.on("double-click", () => {
        this.addProject();
      });
    } else {
      // Linux: clique simples para mostrar menu
      this.tray.on("click", () => {
        this.tray.popUpContextMenu();
      });
    }

    this.tray.on("right-click", () => {
      this.tray.popUpContextMenu();
    });
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

    // Linux: configurações adicionais
    if (this.platform === "linux") {
      app.commandLine.appendSwitch("--enable-transparent-visuals");
      app.commandLine.appendSwitch("--disable-gpu");
    }

    app.whenReady().then(() => {
      this.createTray();
      console.log("🚀 VS Code Tray Launcher iniciado!");
      console.log(`🖥️  Plataforma: ${this.platform}`);
      console.log(`📁 Projetos salvos em: ${this.projectsFile}`);

      if (this.isDev) {
        console.log("�� Modo desenvolvimento ativo");
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
