import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useWebWorker } from '../hooks/useWebWorker';
import FileUploader from '../components/common/FileUploader';
import ProgressBar from '../components/common/ProgressBar';
import { Download, ArrowLeft, X } from 'lucide-react';
import { saveAs } from 'file-saver';

export default function MergePDF() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { executeTask } = useWebWorker();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [resultFile, setResultFile] = useState(null);

  const handleFilesSelected = (files) => {
    setSelectedFiles(files);
    dispatch({ type: 'SET_FILES', payload: files });
  };

  const removeFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      dispatch({ type: 'SET_ERROR', payload: 'Please select at least 2 PDF files' });
      return;
    }

    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_PROGRESS', payload: 0 });

    // Read files as ArrayBuffer
    const fileBuffers = await Promise.all(
      selectedFiles.map(file => file.arrayBuffer())
    );

    executeTask(
      'MERGE_PDF',
      { files: fileBuffers },
      (progress) => {
        dispatch({ type: 'SET_PROGRESS', payload: progress });
      },
      (result) => {
        const blob = new Blob([result], { type: 'application/pdf' });
        setResultFile(blob);
        dispatch({ type: 'SET_PROCESSING', payload: false });
        dispatch({ type: 'SET_PROGRESS', payload: 100 });
      },
      (error) => {
        dispatch({ type: 'SET_ERROR', payload: error });
        dispatch({ type: 'SET_PROCESSING', payload: false });
      }
    );
  };

  const handleDownload = () => {
    if (resultFile) {
      saveAs(resultFile, 'merged.pdf');
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setResultFile(null);
    dispatch({ type: 'RESET' });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-primary mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Merge PDF Files</h1>
          <p className="text-gray-600">
            Combine multiple PDF files into one document
          </p>
        </div>

        {/* File Uploader */}
        {!resultFile && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
            <FileUploader
              onFilesSelected={handleFilesSelected}
              accept={{ 'application/pdf': ['.pdf'] }}
              multiple={true}
            />
          </div>
        )}

        {/* Selected Files List */}
        {selectedFiles.length > 0 && !resultFile && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">
              Selected Files ({selectedFiles.length})
            </h3>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-4 text-red-500 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing */}
        {state.processing && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
            <h3 className="text-lg font-semibold mb-4">Merging PDFs...</h3>
            <ProgressBar progress={state.progress} />
            <p className="text-sm text-gray-600 mt-2">{state.progress}% complete</p>
          </div>
        )}

        {/* Result */}
        {resultFile && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6 text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h3 className="text-2xl font-semibold mb-2">PDF Merged Successfully!</h3>
            <p className="text-gray-600 mb-6">
              Your merged PDF is ready to download
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleDownload}
                className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-600 transition flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Merged PDF
              </button>
              <button
                onClick={handleReset}
                className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Merge Another
              </button>
            </div>
          </div>
        )}

        {/* Action Button */}
        {selectedFiles.length >= 2 && !state.processing && !resultFile && (
          <div className="text-center">
            <button
              onClick={handleMerge}
              className="bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:bg-indigo-600 transition text-lg"
            >
              Merge {selectedFiles.length} PDFs
            </button>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {state.error}
          </div>
        )}
      </div>
    </div>
  );
}