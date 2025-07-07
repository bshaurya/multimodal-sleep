'use client'

import { useState } from 'react'

interface PredictionResult {
  stage: string
  confidence: number
  window: number
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PredictionResult[]>([])
  const [error, setError] = useState<string>('')
  const [message, setMessage] = useState<string>('')

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    const edfFiles = selectedFiles.filter(file => file.name.endsWith('.edf'))
    setFiles(edfFiles)
    setError('')
    setResults([])
  }

  const handlePredict = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))

      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Prediction failed')
      }

      const data = await response.json()
      setResults(data.predictions || [])
      setMessage(data.message || '')
    } catch (err) {
      setError('Failed to process files. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStageLabel = (stage: string) => {
    const labels: { [key: string]: string } = {
      '0': 'Wake',
      '1': 'Stage 1 (Light Sleep)',
      '2': 'Stage 2 (Light Sleep)',
      '3': 'Stage 3/4 (Deep Sleep)',
      '4': 'REM Sleep'
    }
    return labels[stage] || `Stage ${stage}`
  }

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">Sleep Disorder Prediction</h1>
        <p className="subtitle">
          Multimodal sleep stage classification using EEG, EOG, and EMG signals
        </p>
      </header>

      <div className="upload-section">
        <input
          type="file"
          id="file-input"
          className="file-input"
          multiple
          accept=".edf"
          onChange={handleFileUpload}
        />
        <label htmlFor="file-input" className="upload-button">
          Select EDF Files
        </label>
        <p style={{ marginTop: '1rem', color: '#666' }}>
          Upload PSG and Hypnogram EDF files for analysis
        </p>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <h3>Selected Files:</h3>
          {files.map((file, index) => (
            <div key={index} className="file-item">
              <span>{file.name}</span>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          ))}
        </div>
      )}

      <button
        className="predict-button"
        onClick={handlePredict}
        disabled={loading}
      >
        {loading ? 'Processing...' : files.length > 0 ? 'Predict Sleep Stages' : 'Test with Demo Data'}
      </button>

      {message && (
        <div style={{ background: '#e8f5e8', border: '1px solid #4caf50', color: '#2e7d32', padding: '1rem', borderRadius: '4px', margin: '1rem 0' }}>
          {message}
        </div>
      )}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          Processing EDF files and running sleep stage prediction...
        </div>
      )}

      {results.length > 0 && (
        <div className="results">
          <h3>Sleep Stage Predictions</h3>
          {results.map((result, index) => (
            <div key={index} className="stage-result">
              <div>
                <span className="stage-name">
                  Window {result.window}: {getStageLabel(result.stage)}
                </span>
              </div>
              <div className="confidence">
                {(result.confidence * 100).toFixed(1)}% confidence
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}