from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import mne
import tensorflow as tf
import tempfile
import os
from typing import List, Optional
from fastapi import Form
import uvicorn

app = FastAPI(title="Sleep Stage Classification API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None

@app.on_event("startup")
async def load_sleep_model():
    global model
    model_path = "sleep_model.keras"
    if os.path.exists(model_path):
        try:
            model = tf.keras.models.load_model(model_path, compile=False)
            print("Model loaded successfully")
        except Exception as e:
            print(f"Failed to load model: {e}")
            raise HTTPException(status_code=500, detail="Model loading failed")
    else:
        print("Model file not found")
        raise HTTPException(status_code=500, detail="Model file not found")

def process_edf_file(psg_path, start_window=0, num_windows=5):
    """Process EDF file and extract features for specified windows"""
    raw = mne.io.read_raw_edf(psg_path, preload=True, stim_channel=None, verbose=False)
    
    eeg_channels = [name for name in raw.ch_names if "EEG" in name]
    eog_channels = [name for name in raw.ch_names if "EOG" in name]  
    emg_channels = [name for name in raw.ch_names if "EMG" in name]
    
    sig_eeg = raw.get_data(picks=eeg_channels)
    sig_eog = raw.get_data(picks=eog_channels) if eog_channels else np.zeros((1, raw.n_times))
    sig_emg = raw.get_data(picks=emg_channels) if emg_channels else np.zeros((1, raw.n_times))
    
    epoch_len = int(30 * raw.info["sfreq"])
    total_epochs = raw.n_times // epoch_len
    end_window = min(start_window + num_windows, total_epochs)
    
    Xe, Xo, Xm = [], [], []
    
    for i in range(start_window, end_window):
        start = i * epoch_len
        end = start + epoch_len
        
        if end <= sig_eeg.shape[1]:
            seg_eeg = sig_eeg[:, start:end]
            seg_eog = sig_eog[:, start:end] if sig_eog.size > 0 else np.zeros((1, epoch_len))
            seg_emg = sig_emg[:, start:end] if sig_emg.size > 0 else np.zeros((1, epoch_len))
            
            target_len = 3000
            if seg_eeg.shape[1] != target_len:
                if seg_eeg.shape[1] > target_len:
                    seg_eeg = seg_eeg[:, :target_len]
                    seg_eog = seg_eog[:, :target_len] 
                    seg_emg = seg_emg[:, :target_len]
                else:
                    pad_len = target_len - seg_eeg.shape[1]
                    seg_eeg = np.pad(seg_eeg, ((0, 0), (0, pad_len)), mode='constant')
                    seg_eog = np.pad(seg_eog, ((0, 0), (0, pad_len)), mode='constant')
                    seg_emg = np.pad(seg_emg, ((0, 0), (0, pad_len)), mode='constant')
            
            Xe.append(seg_eeg.T)
            Xo.append(seg_eog.T)
            Xm.append(seg_emg.T)
    
    return np.array(Xe), np.array(Xo), np.array(Xm), int(total_epochs)

@app.get("/files")
async def list_files():
    edf_dir = "sleep-telemetry"
    if not os.path.exists(edf_dir):
        return {"files": []}
    
    files = [f for f in os.listdir(edf_dir) if f.endswith('-PSG.edf')]
    return {"files": sorted(files)}

@app.get("/file-info/{filename}")
async def get_file_info(filename: str):
    """get total epochs for a file"""
    file_path = os.path.join("sleep-telemetry", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        raw = mne.io.read_raw_edf(file_path, preload=False, verbose=False)
        epoch_len = int(30 * raw.info["sfreq"])
        total_epochs = raw.n_times // epoch_len
        return {"total_epochs": int(total_epochs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def predict_sleep_stages(
    filename: Optional[str] = Form(None), 
    files: Optional[List[UploadFile]] = File(None),
    start_window: int = Form(0),
    num_windows: int = Form(5)
):
    if not model:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    try:
        results = []
        
        if filename:
            file_path = os.path.join("sleep-telemetry", filename)
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="File not found")
            
            Xe, Xo, Xm, total_epochs = process_edf_file(file_path, start_window, num_windows)
            
            if len(Xe) == 0:
                raise HTTPException(status_code=400, detail="No valid epochs found in specified range")
            
            predictions = model.predict([Xe, Xo, Xm])
            predicted_stages = np.argmax(predictions, axis=1)
            
            for i, stage in enumerate(predicted_stages):
                results.append({
                    'file': filename,
                    'window': int(start_window + i + 1),
                    'stage': int(stage)
                })
        
        elif files:
            for file in files:
                if not file.filename.endswith('.edf'):
                    continue
                    
                with tempfile.NamedTemporaryFile(delete=False, suffix='.edf') as tmp:
                    content = await file.read()
                    tmp.write(content)
                    tmp_path = tmp.name
                
                try:
                    Xe, Xo, Xm, total_epochs = process_edf_file(tmp_path, start_window, num_windows)
                    
                    if len(Xe) == 0:
                        continue
                    
                    predictions = model.predict([Xe, Xo, Xm])
                    predicted_stages = np.argmax(predictions, axis=1)
                    
                    for i, stage in enumerate(predicted_stages):
                        results.append({
                            'file': file.filename,
                            'window': int(start_window + i + 1),
                            'stage': int(stage)
                        })
                finally:
                    os.unlink(tmp_path)
        else:
            raise HTTPException(status_code=400, detail="No file provided")
        
        return {"success": True, "predictions": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)