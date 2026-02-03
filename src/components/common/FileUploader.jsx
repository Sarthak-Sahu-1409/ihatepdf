import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

export default function FileUploader({ onFilesSelected, accept, multiple = true }) {
  const onDrop = useCallback((acceptedFiles) => {
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
        isDragActive
          ? 'border-primary bg-indigo-50'
          : 'border-gray-300 hover:border-primary'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
      {isDragActive ? (
        <p className="text-lg text-primary">Drop files here...</p>
      ) : (
        <>
          <p className="text-lg text-gray-700 mb-2">
            Drag & drop files here, or click to select
          </p>
          <p className="text-sm text-gray-500">
            Your files are processed locally and never uploaded
          </p>
        </>
      )}
    </div>
  );
}