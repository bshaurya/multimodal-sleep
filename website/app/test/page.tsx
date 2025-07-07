'use client'

export default function TestPage() {
  const testAPI = async () => {
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        body: new FormData(),
      })
      const data = await response.json()
      alert(JSON.stringify(data, null, 2))
    } catch (error) {
      alert('Error: ' + error)
    }
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Sleep Prediction Test</h1>
      <button 
        onClick={testAPI}
        style={{
          background: '#000',
          color: '#fff',
          border: 'none',
          padding: '1rem 2rem',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem',
          margin: '2rem'
        }}
      >
        Test API
      </button>
    </div>
  )
}