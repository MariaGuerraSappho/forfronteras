class ScoreRenderer {
  constructor(containerId) {
    this.containerId = containerId;
    this.vf = null;
    this.context = null;
    this.stave = null;
    this.notes = [];
    
    this.initRenderer();
  }
  
  initRenderer() {
    // Initialize the renderer
    const container = document.getElementById(this.containerId);
    const { Renderer, Stave } = Vex.Flow;
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Create renderer
    this.vf = new Renderer(container, Renderer.Backends.SVG);
    
    // Configure renderer with explicit dimensions
    this.vf.resize(700, 150);
    this.context = this.vf.getContext();
    this.context.setFont("Arial", 10);
    
    // Create a stave
    this.stave = new Stave(10, 40, 680);
    this.stave.addClef("treble").addTimeSignature("4/4");
    this.stave.setContext(this.context).draw();
  }
  
  renderNotes(notesData) {
    this.notes = notesData;
    this.context.clear();
    
    // Calculate the needed width based on the number of notes
    // Allow approximately 80px per note with some padding
    const minWidth = 700;
    const desiredWidth = Math.max(minWidth, this.notes.length * 80 + 50);
    
    // Resize the renderer if needed to accommodate all notes
    if (desiredWidth > this.vf.getWidth()) {
      this.vf.resize(desiredWidth, 150);
      // Recreate stave with new width
      this.stave = new Vex.Flow.Stave(10, 40, desiredWidth - 20);
      this.stave.addClef("treble").addTimeSignature("4/4");
    }
    
    // Redraw the stave
    this.stave.setContext(this.context).draw();
    
    if (this.notes.length === 0) return;
    
    const { StaveNote, Accidental } = Vex.Flow;
    const renderedNotes = [];
    
    // Render ALL notes instead of limiting to the last 8
    for (const noteData of this.notes) {
      const noteName = noteData.note.substring(0, noteData.note.length - 1);
      const octave = noteData.note.substring(noteData.note.length - 1);
      
      // Convert to VexFlow notation
      let vfNote = this.convertToVexFlowNote(noteName, octave);
      
      // Create the note
      const staveNote = new StaveNote({
        keys: [vfNote],
        duration: "q"
      });
      
      // Add accidental if needed
      if (noteName.includes('#')) {
        staveNote.addModifier(new Accidental("#"));
      } else if (noteName.includes('b')) {
        staveNote.addModifier(new Accidental("b"));
      }
      
      renderedNotes.push(staveNote);
    }
    
    // Format and draw the notes
    const { Formatter, Voice } = Vex.Flow;
    
    // Always ensure we have at least one note for the voice
    if (renderedNotes.length === 0) {
      renderedNotes.push(new StaveNote({
        keys: ["b/4"],
        duration: "qr" // quarter rest
      }));
    }
    
    const voice = new Voice({ num_beats: this.notes.length, beat_value: 4 });
    voice.addTickables(renderedNotes);
    
    new Formatter().joinVoices([voice]).format([voice], desiredWidth - 100);
    voice.draw(this.context, this.stave);
  }
  
  convertToVexFlowNote(noteName, octave) {
    // Convert note name to VexFlow format (lowercase for note, / for octave)
    let note = noteName.replace('#', '').toLowerCase();
    
    // VexFlow format: note/octave (e.g., "c/4")
    return `${note}/${octave}`;
  }
  
  generateMusicXML(notesData) {
    // Basic MusicXML template
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>For Fronterras Score</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>`;
    
    // Add notes
    for (const noteData of notesData) {
      const noteName = noteData.note.substring(0, noteData.note.length - 1);
      const octave = noteData.note.substring(noteData.note.length - 1);
      
      // Handle accidentals
      let step = noteName.charAt(0);
      let alter = "0";
      if (noteName.includes('#')) {
        alter = "1";
      } else if (noteName.includes('b')) {
        alter = "-1";
      }
      
      // Add note to XML
      xml += `
      <note>
        <pitch>
          <step>${step}</step>
          <alter>${alter}</alter>
          <octave>${octave}</octave>
        </pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>`;
    }
    
    // Close the XML
    xml += `
    </measure>
  </part>
</score-partwise>`;
    
    return xml;
  }
}

export default ScoreRenderer;