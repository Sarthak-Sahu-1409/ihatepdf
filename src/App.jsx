import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Loading from './components/common/Loading';

// Lazy load pages
const Landing = lazy(() => import('./pages/Landing'));
const MergePDF = lazy(() => import('./pages/MergePDF'));
const SplitPDF = lazy(() => import('./pages/SplitPDF'));
const CompressPDF = lazy(() => import('./pages/CompressPDF'));
const PDFtoJPG = lazy(() => import('./pages/PDFtoJPG'));
const JPGtoPDF = lazy(() => import('./pages/JPGtoPDF'));
const SignPDF = lazy(() => import('./pages/SignPDF'));
const WatermarkPDF = lazy(() => import('./pages/WatermarkPDF'));

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/merge" element={<MergePDF />} />
            <Route path="/split" element={<SplitPDF />} />
            <Route path="/compress" element={<CompressPDF />} />
            <Route path="/pdf-to-jpg" element={<PDFtoJPG />} />
            <Route path="/jpg-to-pdf" element={<JPGtoPDF />} />
            <Route path="/sign" element={<SignPDF />} />
            <Route path="/watermark" element={<WatermarkPDF />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;