'use client'

import { useState, useEffect } from 'react'

interface PredictionResult {
  stage: string
  window: number
  file?: string
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PredictionResult[]>([])
  const [error, setError] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [useLocalFiles, setUseLocalFiles] = useState(true)
  const [startWindow, setStartWindow] = useState(0)
  const [numWindows, setNumWindows] = useState(5)
  const [totalEpochs, setTotalEpochs] = useState(0)

  useEffect(() => {
    fetchAvailableFiles()
  }, [])

  const fetchAvailableFiles = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(`${backendUrl}/files`)
      const data = await response.json()
      setAvailableFiles(data.files || [])
      if (data.files && data.files.length > 0) {
        setSelectedFile(data.files[0])
        fetchFileInfo(data.files[0])
      }
    } catch (err) {
      console.error('Failed to fetch files:', err)
    }
  }

  const fetchFileInfo = async (filename: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(`${backendUrl}/file-info/${filename}`)
      const data = await response.json()
      setTotalEpochs(data.total_epochs || 0)
    } catch (err) {
      console.error('Failed to fetch file info:', err)
    }
  }

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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const formData = new FormData()
      
      if (useLocalFiles && selectedFile) {
        formData.append('filename', selectedFile)
        formData.append('start_window', startWindow.toString())
        formData.append('num_windows', numWindows.toString())
      } else if (!useLocalFiles && files.length > 0) {
        files.forEach(file => formData.append('files', file))
        formData.append('start_window', startWindow.toString())
        formData.append('num_windows', numWindows.toString())
      } else {
        throw new Error('No file selected or uploaded')
      }

      const response = await fetch(`${backendUrl}/predict`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Prediction failed')
      }

      const data = await response.json()
      setResults(data.predictions || [])
      setMessage(`Processed ${data.predictions?.length || 0} windows successfully`)
    } catch (err) {
      setError('Failed to connect to backend. Make sure the backend server is running on port 8000.')
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
        <h1 className="title">Sleep Stage Classification</h1>
        <p className="subtitle">
          Multimodal sleep stage classification using EEG, EOG, and EMG signals
        </p>
      </header>

      <div className="upload-section">
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <input
              type="radio"
              checked={useLocalFiles}
              onChange={() => setUseLocalFiles(true)}
            />
            Use sample EDF files
          </label>
          <label style={{ marginLeft: '1rem' }}>
            <input
              type="radio"
              checked={!useLocalFiles}
              onChange={() => setUseLocalFiles(false)}
            />
            Upload your own files
          </label>
        </div>

        {useLocalFiles ? (
          <div>
            <select
              value={selectedFile}
              onChange={(e) => {
                setSelectedFile(e.target.value)
                fetchFileInfo(e.target.value)
              }}
              style={{ padding: '0.5rem', marginBottom: '1rem', width: '100%' }}
            >
              {availableFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
            <p style={{ color: '#666' }}>Select a sample PSG file for analysis</p>
            
            <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Start Window: </label>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, totalEpochs - 1)}
                  value={startWindow}
                  onChange={(e) => setStartWindow(parseInt(e.target.value) || 0)}
                  style={{ padding: '0.25rem', marginLeft: '0.5rem', width: '80px' }}
                />
                <span style={{ marginLeft: '1rem' }}>Number of Windows: </span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={numWindows}
                  onChange={(e) => setNumWindows(parseInt(e.target.value) || 5)}
                  style={{ padding: '0.25rem', marginLeft: '0.5rem', width: '80px' }}
                />
              </div>
              <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                Total epochs available: {totalEpochs} | 
                Analyzing windows {startWindow + 1} to {Math.min(startWindow + numWindows, totalEpochs)}
              </p>
              <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>
                💡 Early windows (0-50) typically show Wake/Light Sleep. 
                Later windows (500+) show deeper sleep stages and REM.
              </p>
            </div>
          </div>
        ) : (
          <div>
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
            
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Start Window: </label>
                <input
                  type="number"
                  min="0"
                  value={startWindow}
                  onChange={(e) => setStartWindow(parseInt(e.target.value) || 0)}
                  style={{ padding: '0.25rem', marginLeft: '0.5rem', width: '80px' }}
                />
                <span style={{ marginLeft: '1rem' }}>Number of Windows: </span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={numWindows}
                  onChange={(e) => setNumWindows(parseInt(e.target.value) || 5)}
                  style={{ padding: '0.25rem', marginLeft: '0.5rem', width: '80px' }}
                />
              </div>
            </div>
          </div>
        )}
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
        {loading ? 'Processing...' : 'Predict Sleep Stages'}
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
                  {result.file && result.file !== 'demo' ? `${result.file} - ` : ''}Window {result.window}: {getStageLabel(result.stage.toString())}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}