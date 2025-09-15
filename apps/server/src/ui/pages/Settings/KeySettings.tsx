import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiKey, CreateKeyRequest } from '@entente/types'
import { api } from '../../utils/api'
import {
  KeyIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

function KeySettings() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRotatedKey, setShowRotatedKey] = useState<{ key: string; name: string } | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    expiresAt: '',
  })

  const queryClient = useQueryClient()

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['keys'],
    queryFn: () => api.get('/keys') as Promise<ApiKey[]>,
  })

  const createKeyMutation = useMutation({
    mutationFn: (data: CreateKeyRequest) => api.post('/keys', data) as Promise<ApiKey>,
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      setShowCreateModal(false)
      setCreateForm({ name: '', expiresAt: '' })
      if (newKey.fullKey) {
        setShowRotatedKey({ key: newKey.fullKey, name: newKey.name })
      }
    },
  })

  const rotateKeyMutation = useMutation({
    mutationFn: (keyId: string) => api.post(`/keys/${keyId}/rotate`, {}) as Promise<ApiKey>,
    onSuccess: (rotatedKey) => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      if (rotatedKey.fullKey) {
        setShowRotatedKey({ key: rotatedKey.fullKey, name: rotatedKey.name })
      }
    },
  })

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/keys/${keyId}`, { revokedBy: 'user' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const handleCreateKey = () => {
    if (!createForm.name.trim()) return

    const data: CreateKeyRequest = {
      name: createForm.name.trim(),
      createdBy: 'user',
    }

    if (createForm.expiresAt) {
      data.expiresAt = new Date(createForm.expiresAt).toISOString()
    }

    createKeyMutation.mutate(data)
  }

  const handleRotateKey = (keyId: string) => {
    if (confirm('Are you sure you want to rotate this key? The old key will stop working immediately.')) {
      rotateKeyMutation.mutate(keyId)
    }
  }

  const handleRevokeKey = (keyId: string, keyName: string) => {
    if (confirm(`Are you sure you want to delete "${keyName}"? This action cannot be undone.`)) {
      revokeKeyMutation.mutate(keyId)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString))
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-base-content">API Keys</h2>
          <p className="text-base-content/70 mt-1">
            Manage API keys for programmatic access to Entente
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary text-primary-content"
          disabled={createKeyMutation.isPending}
        >
          Create New Key
        </button>
      </div>

      {/* Keys List */}
      <div className="bg-base-100 rounded-lg border border-base-300">
        {isLoading ? (
          <div className="p-8 text-center">
            <span className="loading loading-spinner loading-md"></span>
            <p className="mt-2 text-base-content/70">Loading keys...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <KeyIcon className="w-16 h-16 text-base-content/30" />
            </div>
            <h3 className="text-lg font-medium text-base-content mb-2">No API keys found</h3>
            <p className="text-base-content/70 mb-4">
              Create your first API key to start using the Entente API
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-sm text-primary-content"
            >
              Create Your First Key
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Status</th>
                  <th>Last Used</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <div className="font-medium">{key.name}</div>
                      <div className="text-sm text-base-content/60">
                        Created {formatDate(key.createdAt)}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-base-200 px-2 py-1 rounded">
                          {key.keyPrefix}
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.keyPrefix)}
                          className="btn btn-ghost btn-xs"
                          title="Copy key prefix"
                        >
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td>
                      {key.revokedAt ? (
                        <div className="badge badge-error text-error-content">Revoked</div>
                      ) : isExpired(key.expiresAt) ? (
                        <div className="badge badge-warning text-warning-content">Expired</div>
                      ) : (
                        <div className="badge badge-success text-success-content">Active</div>
                      )}
                    </td>
                    <td className="text-sm">
                      {formatDate(key.lastUsedAt)}
                    </td>
                    <td className="text-sm">
                      {key.expiresAt ? (
                        <span className={isExpired(key.expiresAt) ? 'text-error' : ''}>
                          {formatDate(key.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-base-content/60">Never</span>
                      )}
                    </td>
                    <td>
                      {!key.revokedAt && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRotateKey(key.id)}
                            className="btn btn-ghost btn-xs"
                            disabled={rotateKeyMutation.isPending}
                            title="Rotate key"
                          >
                            <ArrowPathIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRevokeKey(key.id, key.name)}
                            className="btn btn-ghost btn-xs text-error"
                            disabled={revokeKeyMutation.isPending}
                            title="Delete key"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Create New API Key</h3>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Key Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="e.g., Production Deploy Key"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text">Expiration Date (optional)</span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered"
                value={createForm.expiresAt}
                onChange={(e) => setCreateForm(prev => ({ ...prev, expiresAt: e.target.value }))}
              />
              <label className="label">
                <span className="label-text-alt">Leave empty for no expiration</span>
              </label>
            </div>

            <div className="modal-action">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                disabled={createKeyMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                className="btn btn-primary text-primary-content"
                disabled={createKeyMutation.isPending || !createForm.name.trim()}
              >
                {createKeyMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Creating...
                  </>
                ) : (
                  'Create Key'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show New/Rotated Key Modal */}
      {showRotatedKey && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <KeyIcon className="w-6 h-6" />
              New API Key
            </h3>

            <div className="alert alert-warning text-warning-content mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>Save this key now! You won't be able to see it again.</span>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-medium">API Key for "{showRotatedKey.name}"</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1 font-mono text-sm"
                  value={showRotatedKey.key}
                  readOnly
                />
                <button
                  onClick={() => copyToClipboard(showRotatedKey.key)}
                  className="btn btn-ghost"
                  title="Copy to clipboard"
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={() => setShowRotatedKey(null)}
                className="btn btn-primary text-primary-content"
              >
                I've Saved the Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KeySettings