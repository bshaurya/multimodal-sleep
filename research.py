#imports
import os
import numpy as np
import mne
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import confusion_matrix, accuracy_score
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Conv1D, BatchNormalization, Activation, MaxPooling1D,
    GlobalAveragePooling1D, Dense, concatenate, Dropout
)
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
stage_map = {
    "W":0,
    "1":1,
    "2":2,
    "3":3,
    "4":3,
    "R":4
}
def load_and_segment(path_psg, path_hyp, subject_id):
    raw = mne.io.read_raw_edf(path_psg, preload=True, stim_channel=None, verbose=False)

    eeg_channels = [name for name in raw.ch_names if "EEG" in name]
    eog_channels = [name for name in raw.ch_names if "EOG" in name]
    emg_channels = [name for name in raw.ch_names if "EMG" in name]

    sig_eeg = raw.get_data(picks=eeg_channels)
    sig_eog = raw.get_data(picks=eog_channels) if eog_channels else np.zeros((0, raw.n_times))
    sig_emg = raw.get_data(picks=emg_channels) if emg_channels else np.zeros((0, raw.n_times))

    ann = mne.read_annotations(path_hyp)

    Xe, Xo, Xm, labs, subs = [], [], [], [], []

    epoch_len = int(30 * raw.info["sfreq"]) # 30 second windows
    for onset, desc in zip(ann.onset, ann.description):
        char = desc.split()[-1]
        if char in stage_map: # skipping M
            start = int(onset * raw.info["sfreq"])

            if start + epoch_len <= sig_eeg.shape[1]:
                seg_eeg = sig_eeg[:, start:start + epoch_len]
                seg_eog = sig_eog[:, start:start + epoch_len] if sig_eog.size > 0 else np.zeros((0, epoch_len))
                seg_emg = sig_emg[:, start:start + epoch_len] if sig_emg.size > 0 else np.zeros((0, epoch_len))

                Xe.append(seg_eeg.T)
                Xo.append(seg_eog.T)
                Xm.append(seg_emg.T)
                labs.append(stage_map[char])
                subs.append(subject_id)

    return np.array(Xe), np.array(Xo), np.array(Xm), np.array(labs), np.array(subs)
base_dir = "/content/drive/My Drive/sleep-edf"
data_dir = base_dir
all_Xe, all_Xo, all_Xm, all_y,all_subj = [], [], [], [], []

for subset in ["sleep-cassette","sleep-telemetry"]:
    subdir = os.path.join(data_dir, subset)
    for fname in os.listdir(subdir):
        if fname.endswith("PSG.edf"):
            psg_path = os.path.join(subdir, fname)
            prefix = fname.replace("-PSG.edf", "")
            hyp_files = [f for f in os.listdir(subdir) if f.startswith(prefix[:-1]) and f.endswith("Hypnogram.edf")]

            if not hyp_files:
                continue

            hyp_path = os.path.join(subdir, hyp_files[0])
            subj_str = prefix[3:5] if subset == "sleep-cassette" else prefix[3:5]
            subj_id = int(subj_str)

            Xe,Xo, Xm,labs,subs = load_and_segment(psg_path, hyp_path, subj_id)
            all_Xe.append(Xe);all_Xo.append(Xo);all_Xm.append(Xm);all_y.append(labs);all_subj.append(subs)

X_eeg, X_eog,X_emg, y, subjects = np.vstack(all_Xe),np.vstack(all_Xo),np.vstack(all_Xm),np.concatenate(all_y),np.concatenate(all_subj)

print(f"Total epochs: {len(y)} (EEG shape: {X_eeg.shape}, EOG shape: {X_eog.shape}, EMG shape: {X_emg.shape})")
print(f"class distrib: {np.bincount(y)}")
print(f"# of subjects: {len(set(subjects))}")
unique_subj = np.unique(subjects)
train_subj,test_subj = train_test_split(np.unique(subjects), test_size=0.2, random_state=42)

train_mask = np.isin(subjects, train_subj)
test_mask = np.isin(subjects, test_subj)

Xe_train, Xe_test, Xo_train, Xo_test, Xm_train,Xm_test,y_train, y_test = X_eeg[train_mask], X_eeg[test_mask], X_eog[train_mask], X_eog[test_mask], X_emg[train_mask], X_emg[test_mask], y[train_mask], y[test_mask]

print(f"Train subj: {len(train_subj)},test subj: {len(test_subj)}")
print(f"Train epochs: {len(y_train)}, Test epochs: {len(y_test)}")
print(f"Train class #: {np.bincount(y_train)}")
n_eeg, n_eog, n_emg = Xe_train.shape[2], Xo_train.shape[2], Xm_train.shape[2]
input_eeg = Input(shape=(3000, n_eeg))
input_eog = Input(shape=(3000, n_eog))
input_emg = Input(shape=(3000, n_emg))

def build_branch(input_tensor, filters=16):
    x = Conv1D(filters, 64, padding='same')(input_tensor)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = MaxPooling1D(4)(x)
    x = Dropout(0.3)(x)

    x = Conv1D(filters*2, 32, padding='same')(x)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = MaxPooling1D(4)(x)
    x = Dropout(0.3)(x)

    return GlobalAveragePooling1D()(x)

branch_eeg = build_branch(input_eeg, filters=16)
branch_eog = build_branch(input_eog, filters=8)
branch_emg = build_branch(input_emg, filters=8)

merged = concatenate([branch_eeg, branch_eog, branch_emg])
x = Dense(64, activation='relu')(merged)
x = Dropout(0.3)(x)
output = Dense(5, activation='softmax')(x)

model = Model([input_eeg, input_eog, input_emg], output)

# lower lr + clipping
optimizer = Adam(learning_rate=1e-4, clipnorm=1.0)
model.compile(optimizer=optimizer,loss='sparse_categorical_crossentropy',metrics=['accuracy'])
model.summary()
perm = np.random.RandomState(0).permutation(len(y_train))
Xe_train, Xo_train, Xm_train = Xe_train[perm], Xo_train[perm], Xm_train[perm]
y_train = y_train[perm]
class_weights = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
class_weights = dict(enumerate(class_weights))
callbacks = [
    EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True
    ),
    ModelCheckpoint(
        filepath='sleep_model.keras',
        monitor='val_loss',
        save_best_only=True,
        save_weights_only=False,
        mode='min',
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=3,
        verbose=1,min_lr=1e-6
    )
]
history = model.fit([Xe_train, Xo_train, Xm_train], y_train,epochs=50,batch_size=64,
    validation_split=0.1,
    callbacks=callbacks,
    class_weight=class_weights,
    verbose=2
)
