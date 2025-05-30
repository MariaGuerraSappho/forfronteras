import PitchDetector from 'pitch-detector';
import ToneGenerator from 'tone-generator';
import ScoreRenderer from 'score-renderer';

class App {
  constructor() {
    this.pitchDetector = new PitchDetector();
    this.toneGenerator = new ToneGenerator();
    this.scoreRenderer = new ScoreRenderer('score-display');
    
    this.notes = [];
    this.isListening = false;
    this.sessionEnded = false;
    this.currentDetectedNote = null;
    this.audioRecorder = null;
    this.recordedChunks = [];
    this.listenTimer = null;
    this.listeningDuration = 5000; // 5 seconds
    this.countdownInterval = null;
    this.pianoKeys = [];
    this.activeTones = [];

    this.mode = 'live'; // 'live' or 'manual' compose mode
    this.playbackTimer = null;
    this.playbackIndex = 0;
    
    this.initElements();
    this.initEventListeners();
    this.loadMicrophones();
    this.createPianoKeyboard();
  }
  
  getJustIntonationFrequency(noteName, octave, rootFreq = 440) {
    const justIntonationRatios = {
      'A': 1,
      'B': 9/8,
      'C#': 5/4,
      'D': 4/3,
      'E': 3/2,
      'F#': 5/3,
      'G#': 15/8,
      'C': 25/16,
      'D#': 6/5,
      'F': 45/32,
      'G': 16/9,
      'A#': 25/16,
      'BB': 16/9,
      'EB': 6/5,
      'GB': 45/32,
    };

    let normalizedNote = noteName.toUpperCase();
    if (noteName.includes('b') && !noteName.includes('#')) {
      normalizedNote = noteName[0].toUpperCase() + 'B';
    }

    const ratio = justIntonationRatios[normalizedNote] || 1;
    const octaveDiff = octave - 4;
    return rootFreq * ratio * Math.pow(2, octaveDiff);
  }
  
  initElements() {
    this.micSelect = document.getElementById('mic-select');
    this.startBtn = document.getElementById('start-btn');
    this.addNoteBtn = document.getElementById('add-note-btn');
    this.endBtn = document.getElementById('end-btn');
    this.detectedNote = document.getElementById('detected-note');
    this.detectedCents = document.getElementById('detected-cents');
    this.exportSection = document.getElementById('export-section');
    this.downloadInputAudioBtn = document.getElementById('download-input-audio-btn');
    this.downloadSineAudioBtn = document.getElementById('download-sine-audio-btn');
    this.exportImageBtn = document.getElementById('export-image-btn');
    this.exportMusicXMLBtn = document.getElementById('export-musicxml-btn');

    // New elements for manual compose mode and playback
    this.modeToggleBtn = document.getElementById('mode-toggle-btn');
    this.playBtn = document.getElementById('play-btn');
    this.stopBtn = document.getElementById('stop-btn');
  }
  
  initEventListeners() {
    this.startBtn.addEventListener('click', () => this.toggleListening());
    this.addNoteBtn.addEventListener('click', () => this.addNote());
    this.endBtn.addEventListener('click', () => this.endSession());
    this.downloadInputAudioBtn.addEventListener('click', () => this.downloadInputAudio());
    this.downloadSineAudioBtn.addEventListener('click', () => this.downloadSineAudio());
    this.exportImageBtn.addEventListener('click', () => this.exportImage());
    this.exportMusicXMLBtn.addEventListener('click', () => this.exportMusicXML());

    if (this.modeToggleBtn) {
      this.modeToggleBtn.addEventListener('click', () => this.toggleMode());
    }
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.playComposition());
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => this.stopPlayback());
    }
  }
  
  createPianoKeyboard() {
    const keyboardElement = document.getElementById('piano-keyboard');
    if (!keyboardElement) return;

    const notes = [
      'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
      'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4'
    ];

    let whiteKeyIndex = 0;

    notes.forEach(note => {
      const isBlackKey = note.includes('#');
      const keyElement = document.createElement('div');

      keyElement.classList.add('piano-key');
      keyElement.classList.add(isBlackKey ? 'black-key' : 'white-key');
      keyElement.dataset.note = note;

      const labelElement = document.createElement('div');
      labelElement.classList.add('key-label');
      labelElement.textContent = note;
      keyElement.appendChild(labelElement);

      if (isBlackKey) {
        keyElement.style.left = `${whiteKeyIndex * 40 - 12}px`;
      } else {
        whiteKeyIndex++;
      }

      keyElement.addEventListener('mousedown', () => {
        if (this.mode === 'manual') {
          this.addNoteManually(note);
        } else {
          this.playPianoNote(note);
        }
        keyElement.classList.add('active');
      });

      keyElement.addEventListener('mouseup', () => {
        this.stopPianoNote(note);
        keyElement.classList.remove('active');
      });

      keyElement.addEventListener('mouseleave', () => {
        this.stopPianoNote(note);
        keyElement.classList.remove('active');
      });

      keyboardElement.appendChild(keyElement);
      this.pianoKeys.push(keyElement);
    });
  }
  
  playPianoNote(note) {
    this.toneGenerator.playNote(note);
  }
  
  stopPianoNote(note) {
    this.toneGenerator.stopNote(note);
  }
  
  async loadMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(device => device.kind === 'audioinput');
      this.micSelect.innerHTML = '';
      microphones.forEach(mic => {
        const option = document.createElement('option');
        option.value = mic.deviceId;
        option.text = mic.label || `Microphone ${this.micSelect.options.length + 1}`;
        this.micSelect.appendChild(option);
      });
      this.micSelect.disabled = false;
      this.startBtn.disabled = false;
    } catch (error) {
      console.error('Error loading microphones:', error);
      alert('Could not access microphones. Please ensure you have granted microphone permissions.');
    }
  }
  
  async toggleListening() {
    if (!this.isListening) {
      await this.startListening();
    } else {
      this.stopListening();
    }
  }
  
  async startListening() {
    try {
      const microphoneId = this.micSelect.value;
      await this.pitchDetector.start(microphoneId);
      this.updateFrequenciesToIgnore();
      const stream = this.pitchDetector.getAudioStream();
      this.audioRecorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
      });
      this.audioRecorder.startRecording();
      this.pitchDetector.onPitch((note, frequency, cents) => {
        if (note && frequency) {
          this.currentDetectedNote = { note, frequency, cents };
          this.updatePitchDisplay(note, cents);
        }
      });
      this.isListening = true;
      this.startBtn.textContent = 'Listening... 5s';
      this.startBtn.disabled = true;
      this.addNoteBtn.disabled = true;
      this.endBtn.disabled = false;
      let secondsLeft = this.listeningDuration / 1000;
      this.countdownInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          this.startBtn.textContent = `Listening... ${secondsLeft}s`;
        }
      }, 1000);
      this.listenTimer = setTimeout(() => {
        this.stopListening();
        this.startBtn.textContent = 'Listen Again';
        this.startBtn.disabled = false;
        if (this.currentDetectedNote) {
          this.addNote();
        }
      }, this.listeningDuration);
    } catch (error) {
      console.error('Error starting pitch detection:', error);
      alert('Could not start pitch detection. Please check your microphone permissions.');
    }
  }
  
  stopListening() {
    if (this.listenTimer) {
      clearTimeout(this.listenTimer);
      this.listenTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.pitchDetector.stop();
    this.isListening = false;
    this.startBtn.textContent = 'Start Listening';
    this.startBtn.disabled = false;
    if (this.currentDetectedNote) {
      this.addNoteBtn.disabled = false;
    }
  }
  
  updatePitchDisplay(note, cents) {
    if (!note) {
      this.detectedNote.textContent = '--';
      this.detectedCents.textContent = '';
      return;
    }
    this.detectedNote.textContent = note;
    if (cents !== undefined && cents !== null) {
      this.detectedCents.textContent = cents > 0 ? `+${cents.toFixed(0)}¢` : `${cents.toFixed(0)}¢`;
    } else {
      this.detectedCents.textContent = '';
    }
  }
  
  addNote() {
    if (!this.currentDetectedNote) return;
    
    const { note } = this.currentDetectedNote;
    const noteName = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));
    
    const justFreq = this.getJustIntonationFrequency(noteName, octave, 440);
    
    this.notes.push({ note, frequency: justFreq });
    
    this.activeTones.push(note);
    
    if (this.activeTones.length > 2) {
      const oldestNote = this.activeTones.shift();
      this.toneGenerator.stopNote(oldestNote);
    }
    
    this.toneGenerator.playNote(note, justFreq);
    
    this.scoreRenderer.renderNotes(this.notes);
    
    this.updateFrequenciesToIgnore();
    
    this.startBtn.textContent = 'Start Listening';
    this.startBtn.disabled = false;
    this.addNoteBtn.disabled = true;
    this.currentDetectedNote = null;
    this.updatePitchDisplay('--', '');
  }
  
  // --- New manual compose methods ---
  toggleMode() {
    this.mode = this.mode === 'live' ? 'manual' : 'live';
    if (this.modeToggleBtn) {
      this.modeToggleBtn.textContent = this.mode === 'live' ? 'Switch to Manual Compose' : 'Switch to Live Input';
    }
    
    if (this.mode === 'manual') {
      this.notes = [];
      this.scoreRenderer.renderNotes(this.notes);
      if (this.playBtn) this.playBtn.disabled = false;
      if (this.stopBtn) this.stopBtn.disabled = false;
      
      // Disable live input buttons to avoid conflict
      this.startBtn.disabled = true;
      this.addNoteBtn.disabled = true;
      this.micSelect.disabled = true;
    } else {
      if (this.playBtn) this.playBtn.disabled = true;
      if (this.stopBtn) this.stopBtn.disabled = true;
      this.startBtn.disabled = false;
      this.addNoteBtn.disabled = true;
      this.micSelect.disabled = false;
    }
  }
  
  addNoteManually(note) {
    this.notes.push({ note, frequency: null });
    this.scoreRenderer.renderNotes(this.notes);
  }
  
  playComposition() {
    if (this.notes.length === 0) return;
    this.playbackIndex = 0;
    this.playNextNote();
  }
  
  playNextNote() {
    if (this.playbackIndex >= this.notes.length) {
      this.stopPlayback();
      return;
    }
    const note = this.notes[this.playbackIndex];
    const freq = note.frequency || this.getJustIntonationFrequency(note.note.slice(0, -1), parseInt(note.note.slice(-1)), 440);
    
    this.toneGenerator.playNote(note.note, freq);
    
    this.playbackTimer = setTimeout(() => {
      this.toneGenerator.stopNote(note.note);
      this.playbackIndex++;
      this.playNextNote();
    }, 600);
  }
  
  stopPlayback() {
    clearTimeout(this.playbackTimer);
    this.playbackTimer = null;
    this.toneGenerator.fadeOutAll(true, 0.5);
    this.playbackIndex = 0;
  }
  
  updateFrequenciesToIgnore() {
    const frequencies = this.notes
      .filter(note => this.activeTones.includes(note.note))
      .map(note => note.frequency);
    this.pitchDetector.setFrequenciesToIgnore(frequencies);
  }
  
  endSession() {
    if (this.sessionEnded) return;
    if (this.isListening) {
      this.stopListening();
    }
    if (this.audioRecorder) {
      this.audioRecorder.stopRecording(() => {
        const blob = this.audioRecorder.getBlob();
        this.recordedAudioBlob = blob;
      });
    }
    this.toneGenerator.fadeOutAll(false, 10);
    this.startBtn.disabled = true;
    this.addNoteBtn.disabled = true;
    this.endBtn.disabled = true;
    this.micSelect.disabled = true;
    this.exportSection.style.display = 'block';
    this.sessionEnded = true;
  }
  
  downloadInputAudio() {
    if (!this.recordedAudioBlob) {
      alert('No input audio recording available.');
      return;
    }
    const url = URL.createObjectURL(this.recordedAudioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'for-fronterras-input-recording.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  downloadSineAudio() {
    this.toneGenerator.generateAudioFile(this.notes)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'for-fronterras-sine-tones.wav';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      })
      .catch(error => {
        console.error('Error generating sine audio:', error);
        alert('Could not generate sine audio file.');
      });
  }
  
  exportImage() {
    const scoreElement = document.getElementById('score-display');
    html2canvas(scoreElement).then(canvas => {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'for-fronterras-score.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }
  
  exportMusicXML() {
    const musicXML = this.scoreRenderer.generateMusicXML(this.notes);
    const blob = new Blob([musicXML], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'for-fronterras-score.musicxml';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
