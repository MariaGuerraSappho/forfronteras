document.addEventListener("DOMContentLoaded", () => {
  // Define note sets for treble and bass
  const trebleNotes = [
    { name: "F", octave: 4, freq: 261.63 * (4 / 3), y: 120 },
    { name: "G", octave: 4, freq: 261.63 * (3 / 2), y: 110 },
    { name: "A", octave: 4, freq: 261.63 * (5 / 3), y: 100 },
    { name: "B", octave: 4, freq: 261.63 * (15 / 8), y: 90 },
    { name: "C", octave: 5, freq: 261.63 * 2, y: 80 },
    { name: "D", octave: 5, freq: (261.63 * 2) * (9 / 8), y: 70 },
    { name: "E", octave: 5, freq: (261.63 * 2) * (5 / 4), y: 60 }
  ];

  const bassNotes = [
    { name: "F", octave: 3, freq: 130.81 * (4 / 3), y: 120 },
    { name: "G", octave: 3, freq: 130.81 * (3 / 2), y: 110 },
    { name: "A", octave: 3, freq: 130.81 * (5 / 3), y: 100 },
    { name: "B", octave: 3, freq: 130.81 * (15 / 8), y: 90 },
    { name: "C", octave: 4, freq: 130.81 * 2, y: 80 },
    { name: "D", octave: 4, freq: (130.81 * 2) * (9 / 8), y: 70 },
    { name: "E", octave: 4, freq: (130.81 * 2) * (5 / 4), y: 60 }
  ];

  // Two note variables: activeNote is used for audio; previewNote is a candidate update.
  let activeNote = null;
  let previewNote = null;
  let audioCtx = null;
  let activeOscillators = []; // Holds currently playing oscillator nodes

  // Grab UI elements (make sure these exist in your HTML)
  const noteHead = document.getElementById("noteHead");         // Active note visual
  const previewNoteHead = document.getElementById("previewNoteHead"); // Preview note visual
  const noteLabel = document.getElementById("noteLabel");
  const clefSymbol = document.getElementById("clefSymbol");
  const playButton = document.getElementById("playButton");
  const nextButton = document.getElementById("nextButton");
  const waveformSelect = document.getElementById("waveformSelect");
  const harmonicityRange = document.getElementById("harmonicityRange");
  const harmonicityValue = document.getElementById("harmonicityValue");
  const clefRadios = document.getElementsByName("clef");

  // Update harmonicity display as the slider moves.
  harmonicityRange.addEventListener("input", (e) => {
    harmonicityValue.textContent = e.target.value;
  });

  // Return current clef ("treble" or "bass")
  function getCurrentClef() {
    for (const radio of clefRadios) {
      if (radio.checked) {
        return radio.value;
      }
    }
    return "treble";
  }

  // Generate a new random note (from the appropriate set) and return it.
  function getRandomNote() {
    const clef = getCurrentClef();
    const noteSet = (clef === "treble") ? trebleNotes : bassNotes;
    const randomIndex = Math.floor(Math.random() * noteSet.length);
    return noteSet[randomIndex];
  }

  // Update the active note display (main note head, label, clef symbol)
  function updateActiveNoteDisplay() {
    if (!activeNote) return;
    noteHead.setAttribute("cy", activeNote.y);
    const displayFreq = activeNote.freq.toFixed(1);
    noteLabel.textContent = `${activeNote.name}${activeNote.octave} – ${displayFreq} Hz`;
    if (clefSymbol) {
      clefSymbol.textContent = (getCurrentClef() === "treble") ? "𝄞" : "𝄢";
    }
    // Update the tuning difference display in cents every time active note is updated.
    updateCentsDifference();
  }

  // Update the preview note display (e.g., show a differently colored note head)
  function updatePreviewNoteDisplay() {
    if (previewNote) {
      previewNoteHead.style.display = "block";
      previewNoteHead.setAttribute("cy", previewNote.y);
      previewNoteHead.style.fill = "orange"; // for example
    } else {
      previewNoteHead.style.display = "none";
    }
  }

  // Generate a new preview note (this does not change the active note or audio).
  function generatePreviewNote() {
    previewNote = getRandomNote();
    updatePreviewNoteDisplay();
  }

  // Compute the equal tempered frequency for a note based on its name and octave.
  function getEqualTemperedFrequency(note) {
    // Mapping for natural notes relative to C in semitones.
    const equalOffsets = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    // Calculate semitone offset from C4.
    const semitoneOffset = equalOffsets[note.name] + 12 * (note.octave - 4);
    return 261.63 * Math.pow(2, semitoneOffset / 12);
  }

  // Calculate the cents difference between the just intonation frequency and equal tempered frequency.
  function getCentsDifference(note) {
    const eqFreq = getEqualTemperedFrequency(note);
    return 1200 * Math.log2(note.freq / eqFreq);
  }

  // Update the DOM element that shows the tuning difference in cents.
  function updateCentsDifference() {
    const centsElem = document.getElementById("centsDifference");
    if (activeNote && centsElem) {
      const diff = getCentsDifference(activeNote);
      const sign = diff > 0 ? "+" : "";
      centsElem.textContent = `Tuning difference: ${sign}${diff.toFixed(2)} cents`;
    }
  }

  // Function to start continuous tone playback based on the active note.
  function startContinuousTone() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const now = audioCtx.currentTime;

    // Create a master gain node for volume control.
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.7, now + 0.05);
    masterGain.connect(audioCtx.destination);

    const waveform = waveformSelect.value;
    const harmonicity = parseFloat(harmonicityRange.value);

    // Primary oscillator using the active note.
    const osc1 = audioCtx.createOscillator();
    osc1.type = waveform;
    osc1.frequency.setValueAtTime(activeNote.freq, now);
    osc1.connect(masterGain);
    osc1.start(now);
    activeOscillators.push(osc1);

    // Optional second oscillator if harmonicity > 1.0.
    if (harmonicity > 1.0) {
      const osc2 = audioCtx.createOscillator();
      osc2.type = waveform;
      osc2.frequency.setValueAtTime(activeNote.freq * harmonicity, now);
      const gain2 = audioCtx.createGain();
      gain2.gain.setValueAtTime(0.3, now);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now);
      activeOscillators.push(osc2);
    }
  }

  // Function to update frequencies of active oscillators to match the active note smoothly.
  function updateActiveOscillatorFrequencies() {
    if (!audioCtx || activeOscillators.length === 0 || !activeNote) return;
    const now = audioCtx.currentTime;
    // Cancel any scheduled changes and ramp the frequency to the new value over 0.1 seconds.
    activeOscillators[0].frequency.cancelScheduledValues(now);
    activeOscillators[0].frequency.linearRampToValueAtTime(activeNote.freq, now + 0.1);
    if (activeOscillators.length > 1) {
      const harmonicity = parseFloat(harmonicityRange.value);
      activeOscillators[1].frequency.cancelScheduledValues(now);
      activeOscillators[1].frequency.linearRampToValueAtTime(activeNote.freq * harmonicity, now + 0.1);
    }
  }

  // Function to stop the tone.
  function stopTone() {
    if (activeOscillators.length > 0) {
      activeOscillators.forEach(osc => osc.stop());
      activeOscillators = [];
      playButton.textContent = "Play";
    }
  }

  // Toggle playback:
  // If no tone is playing, start tone with the active note.
  // If a tone is playing and a preview note exists, then update the active note to the preview note,
  // stop the current tone, and then start a new tone with the new active note.
  // Otherwise, if tone is playing and no preview exists, stop playback.
  function togglePlayback() {
    if (activeOscillators.length === 0) {
      // No tone is playing, so start it using the current active note.
      startContinuousTone();
      playButton.textContent = "Stop";
    } else {
      // Tone is playing.
      if (previewNote) {
        // Switch active note to preview note.
        stopTone(); // stop current tone
        activeNote = previewNote;
        previewNote = null; // clear preview
        updateActiveNoteDisplay();
        updatePreviewNoteDisplay();
        startContinuousTone(); // start new tone with new active note
        playButton.textContent = "Stop";
      } else {
        // No preview exists, so stop playback.
        stopTone();
      }
    }
  }

  // When clef selection changes, update the active note display and clear any preview.
  function handleClefChange() {
    activeNote = getRandomNote();
    previewNote = null;
    updateActiveNoteDisplay();
    updatePreviewNoteDisplay();
  }

  // Initialize active note on page load.
  function initializeNotes() {
    activeNote = getRandomNote();
    previewNote = null;
    updateActiveNoteDisplay();
    updatePreviewNoteDisplay();
  }

  // Event listeners.
  playButton.addEventListener("click", togglePlayback);
  nextButton.addEventListener("click", () => {
    // When "Next" is pressed, update the preview note only.
    generatePreviewNote();
  });
  for (const radio of clefRadios) {
    radio.addEventListener("change", handleClefChange);
  }

  // Initialize on load.
  initializeNotes();
});