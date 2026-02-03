import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useWebWorker } from '../hooks/useWebWorker';
import FileUploader from '../components/common/FileUploader';
import ProgressBar from '../components/common/ProgressBar';
import { Download, ArrowLeft } from 'lucide-react';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function SplitPDF() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { executeTask } = useWebWorker();
  const [selectedFile, setSelectedFile] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [splitRanges, setSplitRanges] = useState([{ start: 1, end: 1 }]);
  const [resultFiles, setResultFiles] = useState([]);

  const handleFileSelected = async (files) => {
    const file = files[0];
    setSelectedFile(file);
    
    // Get total pages using PDF.js
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setTotalPages(pdf.numPages);
    setSplitRanges([{ start: 1, end: pdf.numPages }]);
  };

  const addRange = () => {
    setSplitRanges([...splitRanges, { start: 1, end: totalPages }]);
  };

  const updateRange = (index, field, value) => {
    const newRanges = [...splitRanges];
    newRanges[index][field] = parseInt(value) || 1;
    setSplitRanges(newRanges);
  };

  const removeRange = (index) => {
    setSplitRanges(splitRanges.filter((_, i) => i !== index));
  };

  const handleSplit = async () => {
    if (!selectedFile || splitRanges.length === 0) return;

    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_PROGRESS', payload: 0 });

    const fileBuffer = await selectedFile.arrayBuffer();

    executeTask(
      'SPLIT_PDF',
      { fileBuffer, ranges: splitRanges },
      (progress) => {
        dispatch({ type: 'SET_PROGRESS', payload: progress });
      },
      (result) => {
        setResultFiles(result);
        dispatch({ type: 'SET_PROCESSING', payload: false });
        dispatch({ type: 'SET_PROGRESS', payload: 100 });
      },
      (error) => {
        dispatch({ type: 'SET_ERROR', payload: error });
        dispatch({ type: 'SET_PROCESSING', payload: false });
      }
    );
  };

  const downloadFile = (fileData) => {
    const blob = new Blob([fileData.bytes], { type: 'application/pdf' });
    saveAs(blob, fileData.name);
  };

  const downloadAll = () => {
    resultFiles.forEach(fileData => downloadFile(fileData));
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResultFiles([]);
    setTotalPages(0);
    setSplitRanges([{ start: 1, end: 1 }]);
    dispatch({ type: 'RESET' });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-primary mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Split PDF</h1>
          <p className="text-gray-600">
            Extract specific pages or ranges from your PDF
          </p>
        </div>

        {!selectedFile && !resultFiles.length && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
            <FileUploader
              onFilesSelected={handleFileSelected}
              accept={{ 'application/pdf': ['.pdf'] }}
              multiple={false}
            />
          </div>
        )}

        {selectedFile && !resultFiles.length && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedFile.name} ({totalPages} pages)
            </h3>
            
            <div className="space-y-4 mb-4">
              {splitRanges.map((range, index) => (
                <div key={index} className="flex gap-4 items-center">
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={range.start}
                      onChange={(e) => updateRange(index, 'start', e.target.value)}
                      className="border rounded px-3 py-2 w-24"
                      placeholder="From"
                    />
                    <span className="self-center">to</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={range.end}
                      onChange={(e) => updateRange(index, 'end', e.target.value)}
                      className="border rounded px-3 py-2 w-24"
                      placeholder="To"
                    />
                  </div>
                  {splitRanges.length > 1 && (
                    <button
                      onClick={() => removeRange(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addRange}
              className="text-primary hover:text-indigo-600 font-semibold mb-6"
            >
              + Add Another Range
            </button>

            {!state.processing && (
              <button
                onClick={handleSplit}
                className="w-full bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-600 transition"
              >
                Split PDF
              </button>
            )}
          </div>
        )}

        {state.processing && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
            <h3 className="text-lg font-semibold mb-4">Splitting PDF...</h3>
            <ProgressBar progress={state.progress} />
          </div>
        )}

        {resultFiles.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h3 className="text-2xl font-semibold mb-2">PDF Split Successfully!</h3>
            <p className="text-gray-600 mb-6">
              {resultFiles.length} file(s) created
            </p>
            
            <div className="space-y-2 mb-6">
              {resultFiles.map((file, index) => (
                <button
                  key={index}
                  onClick={() => downloadFile(file)}
                  className="w-full border-2 border-primary text-primary px-4 py-2 rounded-lg hover:bg-indigo-50 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {file.name}
                </button>
              ))}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={downloadAll}
                className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-600 transition"
              >
                Download All
              </button>
              <button
                onClick={handleReset}
                className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Split Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}