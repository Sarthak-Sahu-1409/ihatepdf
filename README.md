<p align="center">
  <img src="image.png" alt="IHatePDF — Privacy-First PDF Tools" width="100%" />
</p>

<h1 align="center">IHatePDF</h1>

<p align="center">
  <b>Privacy-first, lightning-fast PDF toolkit that runs entirely in your browser.</b><br/>
  No uploads. No servers. No sign-up. Works offline.
</p>

<p align="center">
  <a href="https://ihatepdf-taupe.vercel.app/">
    <img src="https://img.shields.io/badge/🔗_Live_Demo-Visit_App-6366f1?style=for-the-badge" alt="Live Demo" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PWA-Offline_Ready-F97316?style=for-the-badge&logo=googlechrome&logoColor=white" alt="PWA" />
</p>

---

## ✨ Highlights

- **🔒 100% Private & Serverless:** All parsing, compression, and signing happens locally right in your browser. No remote uploads exist.
- **⚡ WASM-Accelerated:** Offloads heavy graphical and processing operations to Web Workers utilizing WebAssembly (`@jsquash/jpeg`, `pdfjs-dist`) for near-native desktop speeds.
- **🎨 Premium Animated UI:** Built with Framer Motion and custom Three.js WebGL shaders to deliver a sleek, highly-responsive, micro-animated user experience.
- **📴 Offline Ready PWA:** Fully installable logic. Works dependably without an internet connection.

---

## 🛠️ Features (Tools)

| Tool | Route | Description |
|---|---|---|
| 📄 **Merge PDF** | `/merge` | Drag-and-drop to seamlessly combine multiple PDF files into one streamlined document. |
| ✂️ **Split PDF** | `/split` | Visually isolate and extract specific pages from a PDF to create your new file. |
| � **Rotate PDF** | `/rotate` | Fix page orientation—rotate individual pages or all at once with visual preview. |
| �🗜️ **Compress PDF** | `/compress` | Reduce file sizes out of the box efficiently via background-threaded WASM JPEG encoding presets. |
| 🖼️ **PDF → JPG** | `/pdf-to-jpg` | Instantly rasterize PDF pages into high-quality JPEG images via `OffscreenCanvas`. |
| 📸 **JPG → PDF** | `/jpg-to-pdf` | Neatly convert your local images (PNG, WebP, JPEG, HEIC) back into a sleek standard PDF. |
| ✍️ **Sign PDF** | `/sign` | Digitally sign documents securely by drawing, typing, or uploading a signature overlay. |
| 💧 **Watermark PDF** | `/watermark` | Stamp customized text or image watermarks intuitively across your documents. |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 with lazy-loaded routes via React Router v7 |
| **Build Tool** | Vite 7 (lightning-fast HMR + optimised production builds) |
| **Styling** | Tailwind CSS 4 + Tailwind Merge (`tailwind-merge`) + `clsx` |
| **Animations / WebGL**| Framer Motion & Three.js (with custom WebGL shaders via `@paper-design/shaders`) |
| **PDF & Images** | `pdf-lib` (create / modify), `pdfjs-dist` (render / parse, WASM-backed), `jspdf` (PDF generation), `@jsquash/jpeg` (ultra-fast WASM JPEG encoder) |
| **Concurrency** | Web Workers via custom `useWorker` hook |
| **PWA / Offline** | `vite-plugin-pwa` + Workbox (precache + runtime CDN cache) |
| **File Handling** | `react-dropzone` (drag & drop), `file-saver` (downloads), chunked stream reader |
| **Fonts** | `@fontsource` (Dancing Script, Pacifico, Satisfy, Pinyon Script) — fully offline |
| **Icons** | Lucide React + React Icons (`react-icons`) + Fluent UI 3D Emoji (CDN-cached offline) |
| **Deployment** | Vercel (zero-config, edge CDN) |

---

## 📂 Project Structure

```
pdf-tool/
├── index.html                  # SPA entry point
├── package.json                # Dependencies & npm scripts
├── vite.config.js              # Vite + PWA + Workbox configuration
├── tailwind.config.js          # Tailwind CSS theme & customisations
├── eslint.config.js            # ESLint flat-config linting rules
├── vercel.json                 # Vercel deployment & SPA rewrite rules
├── image.png                   # Project preview / banner image (shown above)
│
├── public/
│   └── manifest.json           # PWA web-app manifest (name, icons, theme colour)
│
└── src/
    ├── main.jsx                # React DOM root — mounts <App />
    ├── App.jsx                 # Router setup — lazy-loads all 7 tool pages
    ├── index.css               # Global styles, Tailwind directives & animations
    │
    ├── assets/                 # Static assets like images and fonts
    │
    ├── components/
    │   ├── common/
    │   │   ├── Loading.jsx             # Suspense fallback spinner
    │   │   └── ProgressBar.jsx         # Animated processing progress bar
    │   ├── features/
    │   │   └── SignaturePad.jsx        # Canvas-based signature drawing pad
    │   └── ui/                         # Advanced premium UI components (Motion, WebGL)
    │       ├── future-navbar.jsx       # Floating animated navigation bar
    │       ├── animated-shader-background.jsx # Three.js WebGL animated background
    │       ├── upload-ui.jsx           # Drag-and-drop animated file picker
    │       └── ...                     # Other interactive UI chunks
    │
    ├── lib/
    │   └── utils.js                    # Utility functions for styling (e.g. cn tailwind merge)
    │
    ├── context/
    │   └── AppContext.jsx      # Global state (files, progress, errors) via useReducer
    │
    ├── hooks/
    │   └── useWorker.js        # Custom hook — spawns Worker, posts tasks, relays progress
    │
    ├── pages/
    │   ├── Landing.jsx         # Homepage — tool carousel, highlights, feature cards
    │   ├── MergePDF.jsx        # Merge multiple PDFs
    │   ├── SplitPDF.jsx        # Split / extract PDF pages
    │   ├── RotatePDF.jsx       # Fix PDF page orientation
    │   ├── CompressPDF.jsx     # Compress PDF file size
    │   ├── PDFtoJPG.jsx        # Convert PDF pages → JPEG images
    │   ├── JPGtoPDF.jsx        # Convert images → PDF document
    │   ├── SignPDF.jsx         # Add digital signature to PDF
    │   └── WatermarkPDF.jsx    # Overlay text watermark on PDF pages
    │
    ├── utils/
    │   ├── formatFileSize.js   # Human-readable file size formatter
    │   ├── saveBlobToDisk.js   # Utility for downloading blobs to local filesystem
    │   └── streamProcessor.js  # Chunked file reader for large-file support (1 MB slices)
    │
    └── workers/
        ├── pdf.worker.js       # Web Worker — PDF signing & basic processing
        └── image.worker.js     # Web Worker — PDF ↔ Image processing (WASM + OffscreenCanvas)
```

---

## ⚙️ Architecture: Fast Processing & WebGL UIs

To prevent the dynamic React UI (and deep 3D WebGL animations) from freezing during heavy file processing, the app implements a highly-parallel architecture utilizing Web Workers and WASM. 

| Layer | Responsibility | Performance Benefits |
|---|---|---|
| **`useWorker` Hook** | Manages worker thread lifecycles dynamically from React. | Processes tasks entirely off-thread, maintaining buttery-smooth user interactions on complex UIs. |
| **`image.worker.js`** | Interacts directly with `OffscreenCanvas`. | Offloads graphic scaling and WASM encoding/decoding via `@jsquash/jpeg` & `pdfjs-dist`. |
| **`pdf.worker.js`** | Processes standard PDF byte buffering. | Handles core `pdf-lib` logic like splitting, merging, signing, and saving chunks without halting DOM animations. |

By coupling the immense computing efficiency of **WebAssembly** alongside the true thread isolation of **Web Workers**, you achieve native data-processing speeds straight from the browser. 

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/Sarthak-Sahu-1409/ihatepdf.git
cd ihatepdf/pdf-tool
```

### Without Docker (Local Development)

> **Requirements:** Node.js 18+ and npm.

```bash
# Install dependencies
npm install

# Start the dev server (with hot-reload)
npm run dev

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

### With Docker 🐳

> **Requirements:** [Docker](https://docs.docker.com/get-docker/) installed and running.

**Using Docker Compose (recommended):**

```bash
# Build and start in one command
docker compose up --build

# Or run in the background
docker compose up --build -d

# Stop the container
docker compose down
```

**Using plain Docker:**

```bash
# Build the image
docker build -t ihatepdf .

# Run the container
docker run -p 8080:80 ihatepdf

# Or run in the background
docker run -d -p 8080:80 --name ihatepdf ihatepdf

# Stop & remove
docker stop ihatepdf && docker rm ihatepdf
```

Once running, open **http://localhost:8080** in your browser.

---

## 🌐 Live Demo

**👉 [https://ihatepdf-git-main-sarthaks-projects-47c7820b.vercel.app/](https://ihatepdf-git-main-sarthaks-projects-47c7820b.vercel.app/)**

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ by <strong>Sarthak</strong><br/>
  <sub>No uploads. No risk. Just results.</sub>
</p>
