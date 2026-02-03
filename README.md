# Privacy PDF Tools

100% client-side PDF manipulation tools. Your files never leave your device.

## Features
- Merge PDFs
- Split PDFs
- Compress PDFs
- PDF to JPG
- JPG to PDF
- Sign PDFs

## Privacy
All processing happens in your browser using Web Workers. No servers, no tracking, no data collection.

## Tech Stack
- React + Vite
- Tailwind CSS
- pdf-lib, pdfjs-dist
- Web Workers
- PWA/Service Workers

## Development
\`\`\`bash
npm install
npm run dev
\`\`\`

## License
MIT
```

### Day 7: Launch!

**Launch Checklist:**
- [ ] All features tested
- [ ] Mobile responsive
- [ ] PWA installable
- [ ] Offline mode works
- [ ] Buy Me a Coffee link added
- [ ] README complete
- [ ] Domain configured (optional)
- [ ] Share on Twitter, Product Hunt, Reddit

---

## File Structure (Final)
```
pdf-tool/
├── public/
│   ├── sw.js
│   ├── manifest.json
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── FileUploader.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── Loading.jsx
│   │   │   └── OfflineIndicator.jsx
│   │   ├── features/
│   │   │   └── SignaturePad.jsx
│   │   └── ErrorBoundary.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── hooks/
│   │   └── useWebWorker.js
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── MergePDF.jsx
│   │   ├── SplitPDF.jsx
│   │   ├── CompressPDF.jsx
│   │   ├── PDFtoJPG.jsx
│   │   ├── JPGtoPDF.jsx
│   │   └── SignPDF.jsx
│   ├── utils/
│   │   └── streamProcessor.js
│   ├── workers/
│   │   ├── pdfWorker.js
│   │   └── imageWorker.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
├── tailwind.config.js
├── vercel.json
└── README.md