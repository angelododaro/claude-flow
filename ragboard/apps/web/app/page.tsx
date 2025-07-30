import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Welcome to RAGBOARD
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            A visual board-style AI interface that combines mind-mapping with RAG capabilities
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/boards"
              className="px-8 py-3 bg-white text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
            >
              View Demo
            </Link>
          </div>
        </div>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-3">🎨 Visual Canvas</h3>
            <p className="text-gray-600">
              Infinite canvas powered by Excalidraw for organizing your knowledge visually
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-3">🤖 AI-Powered</h3>
            <p className="text-gray-600">
              Connect any content to AI chat for context-aware conversations
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-3">👥 Collaborative</h3>
            <p className="text-gray-600">
              Real-time collaboration with team members on the same board
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}