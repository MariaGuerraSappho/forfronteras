import PitchDetector from 'pitch-detector';
import ToneGenerator from 'tone-generator';
import ScoreRenderer from 'score-renderer';

class App {
  constructor() {
    // Duo mode pitch detectors & tone generators
    this.pitchDetector1 = new PitchDetector();
    this.pitchDetector2 = new PitchDetector();

    this.toneGenerator1 = new ToneGenerator();
    this.toneGenerator2 = new ToneGenerator();

    this.scoreRenderer1 = new ScoreRenderer('score-display1');
    this.scoreRenderer2 = new ScoreRenderer('score-display2');

    // Notes for each player
    this.notes1 = [];
    this.notes2 = [];

    this.isListening1 = false;
    this.isListening2 = false;

    this.currentDetectedNote1 = null;
    this.currentDetectedNote2 = null;

    // Playback trackers for each player
    this.playbackIndex1 = 0;
    this.playbackIndex2 = 0;
    this.currentPlayingNote1 = null;
    this.currentPlayingNote2 = null;

    // Manual compose mode toggle
    this.mode = 'live'; // or 'manual'

    // Shared piano keys for manual mode
    this.pianoKeys = [];

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
    this.micSelect1 = document.getElementById('mic-select1');
    this.micSelect2 = document.getElementById('mic-select2');

    this.startBtn1 = document.getElementById('start-btn1');
    this.startBtn2 = document.getElementById('start-btn2');

    this.detectedNote1 = document.getElementById('detected-note1');
    this.detectedCents1 = document.getElementById('detected-cents1');

    this.detectedNote2 = document.getElementById('detected-note2');
    this.detectedCents2 = document.getElementById('detected-cents2');

    this.playBtn1 = document.getElementById('play-btn1');
    this.playBtn2 = document.getElementById('play-btn2');
    this.nextNoteBtn1 = document.getElementById('next-note-btn1');
    this.nextNoteBtn2 = document.getElementById('next-note-btn2');
    this.stopBtn1 = document.getElementById('stop-btn1');
    this.stopBtn2 = document.getElementById('stop-btn2');

    this.modeToggleBtn = document.getElementById('mode-toggle-btn');
    this.endBtn = document.getElementById('end-btn');

    this.downloadInputAudioBtn = document.getElementById('download-input-audio-btn');
    this.downloadSineAudioBtn = document.getElementById('download-sine-audio-btn');
    this.exportImageBtn = document.getElementById('export-image-btn');
    this.exportMusicXMLBtn = document.getElementById('export-musicxml-btn');
  }

  initEventListeners() {
    // Start/stop for each player
    this.startBtn1.addEventListener('click', () => this.toggleListening(1));
    this.startBtn2.addEventListener('click', () => this.toggleListening(2));

    // Playback controls for player 1
    this.playBtn1.addEventListener('click', () => this.playComposition(1));
    this.nextNoteBtn1.addEventListener('click', () => this.playNextNoteStep(1));
    this.stopBtn1.addEventListener('click', () => this.stopPlayback(1));

    // Playback controls for player 2
    this.playBtn2.addEventListener('click', () => this.playComposition(2));
    this.nextNoteBtn2.addEventListener('click', () => this.playNextNoteStep(2));
    this.stopBtn2.addEventListener('click', () => this.stopPlayback(2));

    this.modeToggleBtn.addEventListener('click', () => this.toggleMode());
    this.endBtn.addEventListener('click', () => this.endSession());

    this.downloadInputAudioBtn.addEventListener('click', () => this.downloadInputAudio());
    this.downloadSineAudioBtn.addEventListener('click', () => this.downloadSineAudio());
    this.exportImageBtn.addEventListener('click', () => this.exportImage());
    this.exportMusicXMLBtn.addEventListener('click', () => this.exportMusicXML());
  }

  async loadMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(device => device.kind === 'audioinput');

      this.micSelect1.innerHTML = '';
      this.micSelect2.innerHTML = '';

      microphones.forEach(mic => {
        const option1 = document.createElement('option');
        option1.value = mic.deviceId;
        option1.text = mic.label || `Microphone ${this.micSelect1.options.length + 1}`;
        this.micSelect1.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = mic.deviceId;
        option2.text = mic.label || `Microphone ${this.micSelect2.options.length + 1}`;
        this.micSelect2.appendChild(option2);
      });

      this.micSelect1.disabled = false;
      this.micSelect2.disabled = false;

      this.startBtn1.disabled = false;
      this.startBtn2.disabled = false;

    } catch (error) {
      console.error('Error loading microphones:', error);
      alert('Could not access microphones. Please check permissions.');
    }
  }

  async toggleListening(player) {
    if (player === 1) {
      if (!this.isListening1) {
        await this.startListening(1);
      } else {
        this.stopListening(1);
      }
    } else if (player === 2) {
      if (!this.isListening2) {
        await this.startListening(2);
      } else {
        this.stopListening(2);
      }
    }
  }

  async startListening(player) {
    try {
      const micSelect = player === 1 ? this.micSelect1 : this.micSelect2;
      const pitchDetector = player === 1 ? this.pitchDetector1 : this.pitchDetector2;
      const startBtn = player === 1 ? this.startBtn1 : this.startBtn2;

      await pitchDetector.start(micSelect.value);

      pitchDetector.onPitch((note, frequency, cents) => {
        if (note && frequency) {
          if (player === 1) {
            this.currentDetectedNote1 = { note, frequency, cents };
            this.updatePitchDisplay(note, cents, 1);
            this.addNoteToPlayer(1, note, frequency);
          } else {
            this.currentDetectedNote2 = { note, frequency, cents };
            this.updatePitchDisplay(note, cents, 2);
            this.addNoteToPlayer(2, note, frequency);
          }
        }
      });

      if (player === 1) {
        this.isListening1 = true;
      } else {
        this.isListening2 = true;
      }

      startBtn.textContent = `Listening Player ${player}...`;
      startBtn.disabled = true;
    } catch (error) {
      console.error('Error starting pitch detection:', error);
      alert('Could not start pitch detection. Please check microphone permissions.');
    }
  }

  stopListening(player) {
    const pitchDetector = player === 1 ? this.pitchDetector1 : this.pitchDetector2;
    const startBtn = player === 1 ? this.startBtn1 : this.startBtn2;

    pitchDetector.stop();

    if (player === 1) {
      this.isListening1 = false;
    } else {
      this.isListening2 = false;
    }

    startBtn.textContent = `Start Listening Player ${player}`;
    startBtn.disabled = false;
  }

  updatePitchDisplay(note, cents, player) {
    if (player === 1) {
      this.detectedNote1.textContent = note || '--';
      this.detectedCents1.textContent = cents ? (cents > 0 ? `+${cents.toFixed(0)}¢` : `${cents.toFixed(0)}¢`) : '';
    } else {
      this.detectedNote2.textContent = note || '--';
      this.detectedCents2.textContent = cents ? (cents > 0 ? `+${cents.toFixed(0)}¢` : `${cents.toFixed(0)}¢`) : '';
    }
  }

  addNoteToPlayer(player, note, freq) {
    const noteName = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));
    const justFreq = freq || this.getJustIntonationFrequency(noteName, octave, 440);

    if (player === 1) {
      this.notes1.push({ note, frequency: justFreq });
      this.scoreRenderer1.renderNotes(this.notes1);
      this.toneGenerator1.playNote(note, justFreq);
    } else {
      this.notes2.push({ note, frequency: justFreq });
      this.scoreRenderer2.renderNotes(this.notes2);
      this.toneGenerator2.playNote(note, justFreq);
    }
  }

  toggleMode() {
    this.mode = this.mode === 'live' ? 'manual' : 'live';
    if (this.modeToggleBtn) {
      this.modeToggleBtn.textContent = this.mode === 'live' ? 'Switch to Manual Compose' : 'Switch to Live Input';
    }

    if (this.mode === 'manual') {
      // Clear notes and render empty score for both players
      this.notes1 = [];
      this.notes2 = [];
      this.scoreRenderer1.renderNotes(this.notes1);
      this.scoreRenderer2.renderNotes(this.notes2);

      // Enable play controls for both players in manual mode
      if (this.playBtn1) this.playBtn1.disabled = false;
      if (this.playBtn2) this.playBtn2.disabled = false;
      if (this.nextNoteBtn1) this.nextNoteBtn1.disabled = true;
      if (this.nextNoteBtn2) this.nextNoteBtn2.disabled = true;
      if (this.stopBtn1) this.stopBtn1.disabled = false;
      if (this.stopBtn2) this.stopBtn2.disabled = false;

      // Disable live input controls
      this.startBtn1.disabled = true;
      this.startBtn2.disabled = true;
      this.micSelect1.disabled = true;
      this.micSelect2.disabled = true;
    } else {
      // Disable playback buttons
      if (this.playBtn1) this.playBtn1.disabled = true;
      if (this.playBtn2) this.playBtn2.disabled = true;
      if (this.nextNoteBtn1) this.nextNoteBtn1.disabled = true;
      if (this.nextNoteBtn2) this.nextNoteBtn2.disabled = true;
      if (this.stopBtn1) this.stopBtn1.disabled = true;
      if (this.stopBtn2) this.stopBtn2.disabled = true;

      // Enable live input controls
      this.startBtn1.disabled = false;
      this.startBtn2.disabled = false;
      this.micSelect1.disabled = false;
      this.micSelect2.disabled = false;
    }
  }

  addNoteManually(note) {
    if (this.mode !== 'manual') return;

    // For simplicity, add manual note to both players
    // (You can extend to let user choose player)
    this.notes1.push({ note, frequency: null });
    this.scoreRenderer1.renderNotes(this.notes1);

    this.notes2.push({ note, frequency: null });
    this.scoreRenderer2.renderNotes(this.notes2);
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
          // Play note normally
          this.toneGenerator1.playNote(note);
        }
        keyElement.classList.add('active');
      });
