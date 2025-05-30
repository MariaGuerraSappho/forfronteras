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
    this.listeningDuration = 5000; // 5 seconds instead of 10 seconds
    this.countdownInterval = null;
    this.pianoKeys = []; // Track piano key elements
    
    // Fix: Initialize activeTones as an empty array
    this.activeTones = [];
    
    this.initElements();
    this.initEventListeners();
    this.loadMicrophones();
    this.createPianoKeyboard();
  }
  
  initElements() {
    // Get DOM elements
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
  }
  
  initEventListeners() {
    this.startBtn.addEventListener('click', () => this.toggleListening());
    this.addNoteBtn.addEventListener('click', () => this.addNote());
    this.endBtn.addEventListener('click', () => this.endSession());
    this.downloadInputAudioBtn.addEventListener('click', () => this.downloadInputAudio());
    this.downloadSineAudioBtn.addEventListener('click', () => this.downloadSineAudio());
    this.exportImageBtn.addEventListener('click', () => this.exportImage());
    this.exportMusicXMLBtn.addEventListener('click', () => this.exportMusicXML());
  }
  
  createPianoKeyboard() {
    const keyboardElement = document.getElementById('piano-keyboard');
    if (!keyboardElement) return;
    
    // Define the notes to display (C3 to B4 - two octaves)
    const notes = [
      'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
      'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4'
    ];
    
    // Keep track of white key position for black key placement
    let whiteKeyIndex = 0;
    
    // Create the keys
    notes.forEach((note, index) => {
      const isBlackKey = note.includes('#');
      const keyElement = document.createElement('div');
      
      keyElement.classList.add('piano-key');
      keyElement.classList.add(isBlackKey ? 'black-key' : 'white-key');
      keyElement.dataset.note = note;
      
      // Add note label
      const labelElement = document.createElement('div');
      labelElement.classList.add('key-label');
      labelElement.textContent = note;
      keyElement.appendChild(labelElement);
      
      // Position black keys
      if (isBlackKey) {
        keyElement.style.left = `${whiteKeyIndex * 40 - 12}px`;
      } else {
        whiteKeyIndex++;
      }
      
      // Add event listeners
      keyElement.addEventListener('mousedown', () => {
        this.playPianoNote(note);
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
    // Play the note using the tone generator
    this.toneGenerator.playNote(note);
  }
  
  stopPianoNote(note) {
    // Stop the note using the tone generator
    this.toneGenerator.stopNote(note);
  }
  
  async loadMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      // Clear the select element
      this.micSelect.innerHTML = '';
      
      // Add microphones to the select element
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
      
      // Update frequencies to ignore before starting detection
      this.updateFrequenciesToIgnore();
      
      // Start audio recording
      const stream = this.pitchDetector.getAudioStream();
      this.audioRecorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
      });
      this.audioRecorder.startRecording();
      
      // Set up pitch detection callback
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
      
      // Set up countdown timer
      let secondsLeft = this.listeningDuration / 1000;
      this.countdownInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          this.startBtn.textContent = `Listening... ${secondsLeft}s`;
        }
      }, 1000);
      
      // Auto-stop after listening duration
      this.listenTimer = setTimeout(() => {
        this.stopListening();
        this.startBtn.textContent = 'Listen Again';
        this.startBtn.disabled = false;
        
        // Automatically add the note if one was detected
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
    // Clear the timer if it exists
    if (this.listenTimer) {
      clearTimeout(this.listenTimer);
      this.listenTimer = null;
    }
    
    // Clear the countdown interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    this.pitchDetector.stop();
    this.isListening = false;
    this.startBtn.textContent = 'Start Listening';
    this.startBtn.disabled = false;
    
    // Only enable Add Note if we have a detected note
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
    
    const { note, frequency } = this.currentDetectedNote;
    
    // Add new note to the notes array (keep all notes for notation)
    this.notes.push({ note, frequency });
    
    // Add the new note to active tones
    this.activeTones.push(note);
    
    // If we have more than 2 tones playing, fade out the oldest one
    if (this.activeTones.length > 2) {
      const oldestNote = this.activeTones.shift(); // Remove oldest note from active tones
      this.toneGenerator.stopNote(oldestNote); // Fade out the oldest note
    }
    
    // Play the new tone
    this.toneGenerator.playNote(note, frequency);
    
    // Update the score with all notes
    this.scoreRenderer.renderNotes(this.notes);
    
    // Tell the pitch detector to ignore the frequencies we're playing
    this.updateFrequenciesToIgnore();
    
    // Reset the listening state to prepare for next note
    this.startBtn.textContent = 'Start Listening';
    this.startBtn.disabled = false;
    this.addNoteBtn.disabled = true;
    this.currentDetectedNote = null;
    this.updatePitchDisplay('--', '');
  }
  
  updateFrequenciesToIgnore() {
    // Extract frequencies from active notes only
    const frequencies = this.notes
      .filter(note => this.activeTones.includes(note.note))
      .map(note => note.frequency);
    
    // Tell the pitch detector to ignore these frequencies
    this.pitchDetector.setFrequenciesToIgnore(frequencies);
  }
  
  endSession() {
    if (this.sessionEnded) return;
    
    // Stop listening if needed
    if (this.isListening) {
      this.stopListening();
    }
    
    // Stop recording
    if (this.audioRecorder) {
      this.audioRecorder.stopRecording(() => {
        const blob = this.audioRecorder.getBlob();
        this.recordedAudioBlob = blob;
      });
    }
    
    // Fade out all tones over 10 seconds
    this.toneGenerator.fadeOutAll(false, 10);
    
    // Disable controls
    this.startBtn.disabled = true;
    this.addNoteBtn.disabled = true;
    this.endBtn.disabled = true;
    this.micSelect.disabled = true;
    
    // Show export section
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
    // Use the tone generator to create a synthesized version of all the notes played
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
    // Generate MusicXML from the notes
    const musicXML = this.scoreRenderer.generateMusicXML(this.notes);
    
    // Create a Blob and download
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