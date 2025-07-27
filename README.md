# VS Code Tray

Um launcher minimalista para projetos do VS Code direto da system tray.

![VS Code Tray](https://img.shields.io/badge/VS%20Code-Tray-blue?style=flat-square&logo=visual-studio-code)
![Electron](https://img.shields.io/badge/Electron-Latest-47848F?style=flat-square&logo=electron)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 📋 Sobre

VS Code Tray é uma aplicação simples e eficiente que permite gerenciar e abrir rapidamente seus projetos do Visual Studio Code diretamente da system tray. Ideal para desenvolvedores que trabalham com múltiplos projetos e querem acesso rápido sem ocupar espaço na barra de tarefas.

## ✨ Funcionalidades

- 🚀 **Abertura rápida**: Abra projetos diretamente no VS Code em nova janela
- 📁 **Gerenciamento simples**: Adicione e remova projetos facilmente
- 🔄 **Inicialização automática**: Configure para iniciar com o sistema
- 🎯 **Interface minimalista**: Menu limpo e intuitivo
- 💾 **Persistência**: Seus projetos são salvos automaticamente
- 🔍 **Detecção automática**: Encontra o VS Code automaticamente no sistema
- 🌐 **Cross-platform**: Funciona no Windows e Linux

## 🖼️ Interface
<img width="175" height="171" alt="vscode-tray-1" src="https://github.com/user-attachments/assets/2404166d-adf5-41b7-9979-07c969e429a6" />
<img width="149" height="175" alt="vscode-tray-2" src="https://github.com/user-attachments/assets/ec0c0007-a62b-443b-9a89-71a1510c5306" />


## 🚀 Instalação

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 16 ou superior)
- [Visual Studio Code](https://code.visualstudio.com/) instalado no sistema

### Desenvolvimento

1. **Clone o repositório**

```bash
git clone https://github.com/rabifa/vscode-tray.git
cd vs-code-tray
```

2. **Clone o repositório**

```bash
npm install
```

3. **Execute em modo desenvolvimento**

```bash
npm start
```

## Build para Produção

### 1. Gere o executável

```bash
npm run build
```

### 2. Localize o arquivo

- Windows: dist/vs-code-tray-1.0.0.exe
- Linux: dist/vs-code-tray-1.0.0.AppImage

## 📖 Como Usar

### Primeira Execução

1. Execute o aplicativo
2. Procure o ícone na system tray
3. Clique com o botão direito para abrir o menu

### Adicionando Projetos

1. Clique em "Adicionar Projeto"
2. Selecione a pasta do seu projeto
3. O projeto aparecerá na lista automaticamente

### Removendo Projetos

1. Selecione "Remover projeto"
2. O projeto será removido imediatamente

### Inicialização Automática

1. Habilite a opção de "Iniciar com o sistema"
2. O app será iniciado automaticamente com o sistema
3. Para desabilitar, desmarque a opção de "Iniciar com o sistema"

## Scripts Disponíveis

```bash
npm start        # Executa em modo desenvolvimento
npm run build    # Gera executável para produção
npm run dist     # Alias para build
```
