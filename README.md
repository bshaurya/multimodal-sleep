# Multimodal Sleep Classification Prediction

A full-stack web application for sleep stage classification using EEG, EOG, and EMG signals from EDF files. Includes some training notebooks for the sleep-edf dataset.

## Features

- **Multimodal Analysis**: Processes EEG, EOG, and EMG signals
- **Real-time Prediction**: FastAPI backend hosted on render with TensorFlow model
- **Interactive Frontend**: Next.js web interface
- **File Upload**: Support for custom EDF files
- **Sample Data**: Pre-loaded sleep telemetry files

## Architecture

```
├── backend/           # FastAPI server
│   ├── app.py        # Main API endpoints
│   ├── requirements.txt
│   └── *.edf         # EDF data files
├── website/          # Next.js frontend
│   └── *.edf         # EDF data files
│   └── app/
└─ .ipnyb and .py        # Jupyter notebooks & analysis
```

## Quick Start

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### Frontend Setup
```bash
cd website
npm install
npm run dev
```

### Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Sleep Stages

- **Stage 0**: Wake
- **Stage 1**: Light Sleep
- **Stage 2**: Light Sleep  
- **Stage 3/4**: Deep Sleep
- **Stage 4**: REM Sleep

## Deployment

### Render (Backend)
- Build: `pip install -r requirements.txt`
- Start: `python app.py`
- Add EDF files to backend directory

### Vercel (Frontend)
- Auto-deploys from Git
- Set `NEXT_PUBLIC_BACKEND_URL` environment variable (see .env.example)

## Data Format

Expects EDF files with:
- EEG channels (any containing "EEG")
- EOG channels (any containing "EOG") 
- EMG channels (any containing "EMG")
- 30-second epochs at any sampling rate