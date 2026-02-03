import { Link } from 'react-router-dom';
import { Shield, Lock, Zap, Download } from 'lucide-react';

export default function Landing() {
  const features = [
    {
      icon: <Shield className="w-12 h-12 text-primary" />,
      title: "100% Private",
      description: "Your files never leave your device. All processing happens in your browser."
    },
    {
      icon: <Lock className="w-12 h-12 text-primary" />,
      title: "No Login Required",
      description: "Start using all features immediately. No account, no tracking."
    },
    {
      icon: <Zap className="w-12 h-12 text-primary" />,
      title: "Lightning Fast",
      description: "Web Workers ensure smooth performance even with large files."
    },
    {
      icon: <Download className="w-12 h-12 text-primary" />,
      title: "Works Offline",
      description: "Once loaded, use all features without internet connection."
    }
  ];

  const tools = [
    { name: 'Merge PDF', path: '/merge', icon: '📄' },
    { name: 'Split PDF', path: '/split', icon: '✂️' },
    { name: 'Compress PDF', path: '/compress', icon: '🗜️' },
    { name: 'PDF to JPG', path: '/pdf-to-jpg', icon: '🖼️' },
    { name: 'JPG to PDF', path: '/jpg-to-pdf', icon: '📷' },
    { name: 'Sign PDF', path: '/sign', icon: '✍️' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            PDF Tools That
            <span className="text-primary"> Respect Your Privacy</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Merge, split, compress, convert, and sign PDFs - all in your browser.
            Your files never touch our servers.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/merge"
              className="bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:bg-indigo-600 transition"
            >
              Get Started Free
            </Link>
            <a
              href="https://www.buymeacoffee.com/yourname"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-primary text-primary px-8 py-4 rounded-lg font-semibold hover:bg-indigo-50 transition"
            >
              ☕ Buy Me a Coffee
            </a>
          </div>
        </div>
      </section>

      {/* Privacy Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">All Tools</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tools.map((tool, idx) => (
            <Link
              key={idx}
              to={tool.path}
              className="bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition border-2 border-transparent hover:border-primary"
            >
              <div className="text-4xl mb-3">{tool.icon}</div>
              <h3 className="text-xl font-semibold">{tool.name}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 bg-white rounded-2xl my-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Upload Your Files</h3>
              <p className="text-gray-600">Drag and drop or click to select PDF/image files from your computer.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Process Locally</h3>
              <p className="text-gray-600">All processing happens in your browser using Web Workers. No uploads to servers.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Download Result</h3>
              <p className="text-gray-600">Your processed file downloads instantly to your device.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-600">
        <p>© 2024 Privacy PDF Tools. Open source and privacy-first.</p>
        <p className="mt-2">
          <a href="https://github.com/yourrepo" className="text-primary hover:underline">
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}