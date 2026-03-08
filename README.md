# ⚡ Dynamore

### A sleek, high-performance DynamoDB desktop client for power users.

![Dynamore Mockup](file:///home/nuwan/.gemini/antigravity/brain/613b1244-afed-46c3-8f96-52d03546c2cd/dynamos_mockup_1772471766516.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Powered by React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Built with Electron](https://img.shields.io/badge/Electron-31-blue.svg)](https://www.electronjs.org/)
[![AWS SDK](https://img.shields.io/badge/AWS-SDK-orange.svg)](https://aws.amazon.com/sdk-for-javascript/)

Dynamore is a modern, cross-platform desktop application designed to make managing AWS DynamoDB tables and data effortless. Built with performance and user experience in mind, it provides a powerful interface for developers to interact with their NoSQL data.

---

## ✨ Key Features

- **🔐 AWS SSO Integration**: Securely connect using your AWS Identity Center profiles.
- **🏗️ Table Management**: Create and delete tables with an intuitive wizard.
- **🔍 Advanced Querying**: Build complex queries with a dedicated Query Builder.
- **📊 Scan Capability**: Flexible scan operations with filtering.
- **📝 JSON Item Editor**: Edit DynamoDB items directly in a streamlined JSON editor.
- **🎨 Modern UI**: Beautiful, dark-themed interface built with Ant Design and custom glassmorphism effects.
- **⚡ Blazing Fast**: Optimized with Electron and Vite for a responsive experience.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nuwanwimalasena/dynamore.git
   cd dynamore
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Packaging the Application

To create a standalone installer for your current OS:

```bash
npm run package
```

The installers will be available in the `dist/` directory.

### Publishing Releases (Automated)

This project is configured with GitHub Actions to automatically build and publish releases. To trigger a release:

1. Update the version in `package.json`.
2. Push a new tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

The workflow in `.github/workflows/release.yml` will handle the rest.

---

## 🛠️ Built With

- **[Electron](https://www.electronjs.org/)**: Desktop application framework.
- **[electron-builder](https://www.electron.build/)**: Complete solution to package and dev Electron apps.
- **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling.
- **[React](https://reactjs.org/)**: UI library.
- **[Ant Design](https://ant.design/)**: Enterprise-class UI design language.
- **[Zustand](https://github.com/pmndrs/zustand)**: Light-weight state management.
- **[AWS SDK for JavaScript v3](https://aws.amazon.com/sdk-for-javascript/)**: Modular AWS integration.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ for the AWS community.
</p>
