'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { Plus, MoreVertical, Trash2, Calendar, Loader2 } from 'lucide-react'

export default function BoardsPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  const { data: boards, isLoading } = trpc.board.list.useQuery()
  const utils = trpc.useUtils()
  
  const createBoard = trpc.board.create.useMutation({
    onSuccess: (board) => {
      utils.board.list.invalidate()
      router.push(`/boards/${board.id}`)
    },
  })
  
  const deleteBoard = trpc.board.delete.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate()
    },
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBoardName.trim()) return

    createBoard.mutate({ name: newBoardName })
    setNewBoardName('')
    setIsCreating(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Boards</h1>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Board
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className="mb-6 bg-white p-4 rounded-lg shadow">
            <input
              type="text"
              placeholder="Board name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={createBoard.isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {createBoard.isLoading ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {boards?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No boards yet. Create your first board to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards?.map((board) => (
              <div
                key={board.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
              >
                <Link href={`/boards/${board.id}`}>
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {board.name}
                    </h3>
                    {board.description && (
                      <p className="mt-1 text-sm text-gray-500 truncate">
                        {board.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center text-xs text-gray-400">
                      <Calendar className="h-3 w-3 mr-1" />
                      Updated {new Date(board.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
                <div className="bg-gray-50 px-6 py-3 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      if (confirm('Are you sure you want to delete this board?')) {
                        deleteBoard.mutate({ id: board.id })
                      }
                    }}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}