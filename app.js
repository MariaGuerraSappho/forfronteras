import PitchDetector from 'pitch-detector';
import ToneGenerator from 'tone-generator';
import ScoreRenderer from 'score-renderer';

class App {
  constructor() {
    this.player1 = this.createPlayerState('1');
    this.player2 = this.createPlayerState('2');
    this.mode = 'live'; // 'live' or 'manual'
    this.activePlayer = '1'; // For manual mode piano input

    this.listeningDuration = 5000; // 5 seconds

    this.pianoKeys = [];

    this.initElements();
    this.initEventListeners();
    this.loadMicrophones();
    this.createPianoKeyboard();

    // Disable piano keyboard on start (enabled only in manual mode)
    this.setPianoKeyboardEnabled(false);
  }

  createPlayerState(id) {
    return {
      pitchDetector: new PitchDetector(),
      toneGenerator: new ToneGenerator(),
      scoreRenderer: new ScoreRenderer(`score-display${id}`),
      notes: [],
      isListening: false,
      currentDetectedNote: null,
      playbackIndex: 0,
      currentPlayingNote: null,
      audioRecorder: null,
      listenTimer: null,
      countdownInterval: null,
      activeTones: [],
      micSelect: null,
      startBtn: null,
      detectedNoteElem: null,
      detectedCentsElem: null,
      playBtn: null,
      nextNoteBtn: null,
      stopBtn: null,
    };
  }

  getJustIntonationFrequency(noteName, octave, rootFreq = 440) {
    const justIntonationRatios = {
      'A': 1,
      'B': 9 / 8,
      'C#': 5 / 4,
      'D': 4 / 3,
      'E': 3 / 2,
      'F#': 5 / 3,
      'G#': 15 / 8,
      'C': 25 / 16,
      'D#': 6 / 5,
      'F': 45 / 32,
      'G': 16 / 9,
      'A#': 25 / 16,
      'BB': 16 / 9,
      'EB': 6 / 5,
      'GB': 45 / 32,
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
    // Player 1
    this.player1.micSelect = document.getElementById('mic-select1');
    this.player1.startBtn = document.getElementById('start-btn1');
    this.player1.detectedNoteElem = document.getElementById('detected-note1');
    this.player1.detectedCentsElem = document.getElementById('detected-cents1');
    this.player1.playBtn = document.getElementById('play-btn1');
    this.player1.nextNoteBtn = document.getElementById('next-note-btn1');
    this.player1.stopBtn = document.getElementById('stop-btn1');

    // Player 2
    this.player2.micSelect = document.getElementById('mic-select2');
    this.player2.startBtn = document.getElementById('start-btn2');
    this.player2.detectedNoteElem = document.getElementById('detected-note2');
    this.player2.detectedCentsElem = document.getElementById('detected-cents2');
    this.player2.playBtn = document.getElementById('play-btn2');
    this.player2.nextNoteBtn = document.getElementById('next-note-btn2');
    this.player2.stopBtn = document.getElementById('stop-btn2');

    this.modeToggleBtn = document.getElementById('mode-toggle-btn');
    this.endBtn = document.getElementById('end-btn');

    this.exportSection = document.getElementById('export-section');
    this.downloadInputAudioBtn = document.getElementById('download-input-audio-btn');
    this.downloadSineAudioBtn = document.getElementById('download-sine-audio-btn');
    this.exportImageBtn = document.getElementById('export-image-btn');
    this.exportMusicXMLBtn = document.getElementById('export-musicxml-btn');
  }

  initEventListeners() {
    // Player 1 events
    if (this.player1.startBtn) this.player1.startBtn.addEventListener('click', () => this.toggleListening('1'));
    if (this.player1.playBtn) this.player1.playBtn.addEventListener('click', () => this.playComposition('1'));
    if (this.player1.nextNoteBtn) this.player1.nextNoteBtn.addEventListener('click', () => this.playNextNoteStep('1'));
    if (this.player1.stopBtn) this.player1.stopBtn.addEventListener('click', () => this.stopPlayback('1'));

    // Player 2 events
    if (this.player2.startBtn) this.player2.startBtn.addEventListener('click', () => this.toggleListening('2'));
    if (this.player2.playBtn) this.player2.playBtn.addEventListener('click', () => this.playComposition('2'));
    if (this.player2.nextNoteBtn) this.player2.nextNoteBtn.addEventListener('click', () => this.playNextNoteStep('2'));
    if (this.player2.stopBtn) this.player2.stopBtn.addEventListener('click', () => this.stopPlayback('2'));

    // Common
    if (this.modeToggleBtn) this.modeToggleBtn.addEventListener('click', () => this.toggleMode());
    if (this.endBtn) this.endBtn.addEventListener('click', () => this.endSession());

    if (this.downloadInputAudioBtn) this.downloadInputAudioBtn.addEventListener('click', () => this.downloadInputAudio());
    if (this.downloadSineAudioBtn) this.downloadSineAudioBtn.addEventListener('click', () => this.downloadSineAudio());
    if (this.exportImageBtn) this.exportImageBtn.addEventListener('click', () => this.exportImage());
    if (this.exportMusicXMLBtn) this.exportMusicXMLBtn.addEventListener('click', () => this.exportMusicXML());

    // Add event listeners for player selection radio buttons
    const playerRadios = document.querySelectorAll('input[name="activePlayer"]');
    playerRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.activePlayer = e.target.value;
      });
    });
  }

  setPianoKeyboardEnabled(enabled) {
    this.pianoKeys.forEach(key => {
      key.style.pointerEvents = enabled ? 'auto' : 'none';
      key.style.opacity = enabled ? '1' : '0.5';
    });
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
    this.player1.toneGenerator.playNote(note);
    this.player2.toneGenerator.playNote(note);
  }

  stopPianoNote(note) {
    this.player1.toneGenerator.stopNote(note);
    this.player2.toneGenerator.stopNote(note);
  }

  async loadMicrophones() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(device => device.kind === 'audioinput');

      // Clear both selects
      this.player1.micSelect.innerHTML = '';
      this.player2.micSelect.innerHTML = '';

      microphones.forEach(mic => {
        const option1 = document.createElement('option');
        option1.value = mic.deviceId;
        option1.text = mic.label || `Microphone ${this.player1.micSelect.options.length + 1}`;
        this.player1.micSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = mic.deviceId;
        option2.text = mic.label || `Microphone ${this.player2.micSelect.options.length + 1}`;
        this.player2.micSelect.appendChild(option2);
      });

      this.player1.micSelect.disabled = false;
      this.player1.startBtn.disabled = false;
      this.player2.micSelect.disabled = false;
      this.player2.startBtn.disabled = false;
    } catch (error) {
      console.error('Error loading microphones:', error);
      alert('Could not access microphones. Please ensure you have granted microphone permissions.');
    }
  }

  async toggleListening(playerId) {
    const player = this[`player${playerId}`];
    if (!player.isListening) {
      await this.startListening(playerId);
    } else {
      this.stopListening(playerId);
    }
  }

  async startListening(playerId) {
    const player = this[`player${playerId}`];
    try {
      const microphoneId = player.micSelect.value;
      await player.pitchDetector.start(microphoneId);
      player.listenTimer && clearTimeout(player.listenTimer);
      player.countdownInterval && clearInterval(player.countdownInterval);

      player.audioRecorder = new RecordRTC(player.pitchDetector.getAudioStream(), {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
      });
      player.audioRecorder.startRecording();

      player.pitchDetector.onPitch((note, frequency, cents) => {
        if (note && frequency) {
          player.currentDetectedNote = { note, frequency, cents };
          this.updatePitchDisplayPlayer(playerId, note, cents);
        }
      });

      player.isListening = true;
      player.startBtn.textContent = `Listening Player ${playerId}... 5s`;
      player.startBtn.disabled = true;
      this.endBtn.disabled = false;

      let secondsLeft = this.listeningDuration / 1000;
      player.countdownInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          player.startBtn.textContent = `Listening Player ${playerId}... ${secondsLeft}s`;
        }
      }, 1000);

      player.listenTimer = setTimeout(() => {
        this.stopListening(playerId);
        player.startBtn.textContent = `Start Listening Player ${playerId}`;
        player.startBtn.disabled = false;
        if (player.currentDetectedNote) {
          this.addNote(playerId);
        }
      }, this.listeningDuration);
    } catch (error) {
      console.error(`Error starting pitch detection Player ${playerId}:`, error);
      alert(`Could not start pitch detection Player ${playerId}. Please check your microphone permissions.`);
    }
  }

  stopListening(playerId) {
    const player = this[`player${playerId}`];
    if (player.listenTimer) {
      clearTimeout(player.listenTimer);
      player.listenTimer = null;
    }
    if (player.countdownInterval) {
      clearInterval(player.countdownInterval);
      player.countdownInterval = null;
    }
    player.pitchDetector.stop();
    player.isListening = false;
    player.startBtn.textContent = `Start Listening Player ${playerId}`;
    player.startBtn.disabled = false;
  }

  updatePitchDisplayPlayer(playerId, note, cents) {
    const player = this[`player${playerId}`];
    if (!note) {
      player.detectedNoteElem.textContent = '--';
      player.detectedCentsElem.textContent = '';
      return;
    }
    player.detectedNoteElem.textContent = note;
    if (cents !== undefined && cents !== null) {
      player.detectedCentsElem.textContent = cents > 0 ? `+${cents.toFixed(0)}¢` : `${cents.toFixed(0)}¢`;
    } else {
      player.detectedCentsElem.textContent = '';
    }
  }

  addNote(playerId) {
    const player = this[`player${playerId}`];
    if (!player.currentDetectedNote) return;

    const { note } = player.currentDetectedNote;
    const noteName = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));

    const justFreq = this.getJustIntonationFrequency(noteName, octave, 440);

    player.notes.push({ note, frequency: justFreq });
    player.activeTones.push(note);

    if (player.activeTones.length > 2) {
      const oldestNote = player.activeTones.shift();
      player.toneGenerator.stopNote(oldestNote);
    }

    player.toneGenerator.playNote(note, justFreq);
    player.scoreRenderer.renderNotes(player.notes);

    this.updateFrequenciesToIgnore(playerId);

    player.currentDetectedNote = null;
    this.updatePitchDisplayPlayer(playerId, '--', '');
  }

  toggleMode() {
    this.mode = this.mode === 'live' ? 'manual' : 'live';
    if (this.modeToggleBtn) {
      this.modeToggleBtn.textContent = this.mode === 'live' ? 'Switch to Manual Compose' : 'Switch to Live Input';
    }

    if (this.mode === 'manual') {
      this.player1.notes = [];
      this.player2.notes = [];
      this.player1.scoreRenderer.renderNotes(this.player1.notes);
      this.player2.scoreRenderer.renderNotes(this.player2.notes);

      if (this.player1.playBtn) this.player1.playBtn.disabled = false;
      if (this.player1.stopBtn) this.player1.stopBtn.disabled = false;
      if (this.player1.nextNoteBtn) this.player1.nextNoteBtn.disabled = true;

      if (this.player2.playBtn) this.player2.playBtn.disabled = false;
      if (this.player2.stopBtn) this.player2.stopBtn.disabled = false;
      if (this.player2.nextNoteBtn) this.player2.nextNoteBtn.disabled = true;

      this.player1.startBtn.disabled = true;
      this.player1.micSelect.disabled = true;
      this.player2.startBtn.disabled = true;
      this.player2.micSelect.disabled = true;

      this.setPianoKeyboardEnabled(true); // Enable piano keyboard only in manual mode
    } else {
      if (this.player1.playBtn) this.player1.playBtn.disabled = true;
      if (this.player1.stopBtn) this.player1.stopBtn.disabled = true;
      if (this.player1.nextNoteBtn) this.player1.nextNoteBtn.disabled = true;

      if (this.player2.playBtn) this.player2.playBtn.disabled = true;
      if (this.player2.stopBtn) this.player2.stopBtn.disabled = true;
      if (this.player2.nextNoteBtn) this.player2.nextNoteBtn.disabled = true;

      this.player1.startBtn.disabled = false;
      this.player1.micSelect.disabled = false;
      this.player2.startBtn.disabled = false;
      this.player2.micSelect.disabled = false;

      this.setPianoKeyboardEnabled(false); // Disable piano keyboard in live mode
    }
  }

  addNoteManually(note) {
    // Add to active player in manual mode
    const player = this.activePlayer === '1' ? this.player1 : this.player2;
    player.notes.push({ note, frequency: null });
    player.scoreRenderer.renderNotes(player.notes);
  }

  playComposition(playerId) {
    const player = this[`player${playerId}`];
    if (player.notes.length === 0) return;
    player.playbackIndex = 0;
    if (player.nextNoteBtn) player.nextNoteBtn.disabled = false;
    this.playNextNoteStep(playerId);
  }

  playNextNoteStep(playerId) {
    const player = this[`player${playerId}`];
    if (player.notes.length === 0) return;

    // Stop current playing note if any
    if (player.currentPlayingNote) {
      player.toneGenerator.stopNote(player.currentPlayingNote);
    }

    // If playbackIndex is at or beyond notes length, reset to start
    if (player.playbackIndex >= player.notes.length) {
      player.playbackIndex = 0;
    }

    const note = player.notes[player.playbackIndex];
    const freq = note.frequency || this.getJustIntonationFrequency(note.note.slice(0, -1), parseInt(note.note.slice(-1)), 440);

    player.toneGenerator.playNote(note.note, freq);
    player.currentPlayingNote = note.note;

    player.playbackIndex++;

    // Disable nextNoteBtn if at end of notes
    if (player.playbackIndex >= player.notes.length) {
      if (player.nextNoteBtn) player.nextNoteBtn.disabled = true;
    } else {
     
