import { TranscriptionSegment } from "../components/VideoUpload";

export const MAX_SEGMENT_LENGTH = 2.5; // maximum length in seconds
export const MIN_SEGMENT_LENGTH = 0.5; // minimum length in seconds
export const MAX_SEGMENT_WORD_LENGTH = 6; // maximum length in words

// utils/measureText.js


export function measureText(text: string, fontSize: number, fontName: string): number {
  // Character width approximations (relative to fontSize)
  const charWidthMap = {
    // Narrow characters
    'i': 0.3, 'l': 0.3, 'I': 0.3, 'j': 0.3, 't': 0.4, 'f': 0.4, 'r': 0.4,
    // Normal characters
    'a': 0.5, 'b': 0.5, 'c': 0.5, 'd': 0.5, 'e': 0.5, 'g': 0.5, 'h': 0.5, 'k': 0.5, 
    'n': 0.5, 'o': 0.5, 'p': 0.5, 'q': 0.5, 's': 0.5, 'u': 0.5, 'v': 0.5, 'x': 0.5, 
    'y': 0.5, 'z': 0.5, 'A': 0.7, 'B': 0.7, 'C': 0.7, 'D': 0.7, 'E': 0.6, 'F': 0.6, 
    'G': 0.7, 'H': 0.7, 'J': 0.5, 'K': 0.7, 'L': 0.6, 'N': 0.7, 'O': 0.7, 'P': 0.7, 
    'Q': 0.7, 'R': 0.7, 'S': 0.7, 'T': 0.6, 'U': 0.7, 'V': 0.7, 'X': 0.7, 'Y': 0.7, 
    'Z': 0.6, '0': 0.6, '1': 0.4, '2': 0.6, '3': 0.6, '4': 0.6, '5': 0.6, '6': 0.6, 
    '7': 0.6, '8': 0.6, '9': 0.6,
    // Wide characters
    'm': 0.8, 'w': 0.8, 'M': 0.9, 'W': 0.9,
    // Punctuation and special characters
    '.': 0.3, ',': 0.3, ':': 0.3, ';': 0.3, ' ': 0.3, '!': 0.3, '?': 0.6,
    '(': 0.4, ')': 0.4, '[': 0.4, ']': 0.4, '{': 0.4, '}': 0.4,
    '@': 0.9, '#': 0.7, '$': 0.6, '%': 0.9, '^': 0.5, '&': 0.7, '*': 0.5,
    '-': 0.4, '+': 0.6, '=': 0.6, '_': 0.6, '~': 0.6, '`': 0.3, "'": 0.3, '"': 0.5,
    '/': 0.4, '\\': 0.4, '|': 0.3, '<': 0.6, '>': 0.6
  };

  // Font scaling based on common fonts
  // Add more fonts with their approximate scaling factors
  const fontScaling = {
    'Arial': 1.0,
    'Helvetica': 1.0,
    'Times New Roman': 0.95,
    'Times': 0.95,
    'Courier New': 1.1,
    'Courier': 1.1,
    'Verdana': 1.05,
    'Georgia': 1.0,
    'Palatino': 1.0,
    'Garamond': 0.9,
    'Bookman': 1.05,
    'Comic Sans MS': 1.1,
    'Trebuchet MS': 1.0,
    'Arial Black': 1.15,
    'Impact': 1.1,
    'Tahoma': 1.0
  };

  let totalWidth = 0;
  const fontFactor = fontScaling[fontName as keyof typeof fontScaling] || 1.0;

  // Calculate width based on each character
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charWidth = charWidthMap[char as keyof typeof charWidthMap] || 0.6;
    totalWidth += charWidth;
  }

  // Apply font size and font scaling
  return totalWidth * fontSize * fontFactor;
}

/**
 * Preprocesses segments to ensure no segment is longer than MAX_SEGMENT_LENGTH seconds
 * and no new segment is shorter than MIN_SEGMENT_LENGTH seconds
 * Splits longer segments while preserving word boundaries
 */
export function preprocessSegments(segments: TranscriptionSegment[] ): TranscriptionSegment[] {
  console.log(`unprocessed segments:${JSON.stringify(segments)}`)
  const processedSegments: TranscriptionSegment[] = [];
  let nextId = 0;

  segments.forEach(segment => {
    const duration = segment.end - segment.start;
    
    if ((duration <= MAX_SEGMENT_LENGTH && (segment.text.split(" ").length <= MAX_SEGMENT_WORD_LENGTH ) || !segment.text.includes(' ') || duration <= MIN_SEGMENT_LENGTH )) {
      segment.id = nextId;
      nextId+=1;
      processedSegments.push(segment);
      return;
    }

    // Split segment recursively
    const splitSegments = splitSegmentRecursively(segment, nextId);
    processedSegments.push(...splitSegments);
    nextId += splitSegments.length;
  });
  console.log(`processed segments:${JSON.stringify(processedSegments)}`)
  return processedSegments;
}

/**
 * Recursively splits a segment until all resulting segments are within MAX_SEGMENT_LENGTH
 * while ensuring no new segment is shorter than MIN_SEGMENT_LENGTH
 */
function splitSegmentRecursively(segment: TranscriptionSegment, nextId: number): TranscriptionSegment[] {
  const duration = segment.end - segment.start;
  segment.id = nextId;

  if ((duration <= MAX_SEGMENT_LENGTH && (segment.text.split(" ").length <= MAX_SEGMENT_WORD_LENGTH ) || !segment.text.includes(' ') || duration <= MIN_SEGMENT_LENGTH )) {
    return [segment]
  }

  // Find the middle time point
  const midTime = segment.start + duration / 2;

  // Find the middle character position
  const midCharIndex = Math.floor(segment.text.length / 2);

  // Calculate potential segment durations
  const firstSegmentDuration = midTime - segment.start;
  const secondSegmentDuration = segment.end - midTime;

  // If either potential segment would be too short, don't split
  if (firstSegmentDuration < MIN_SEGMENT_LENGTH && secondSegmentDuration < MIN_SEGMENT_LENGTH) {
    return [segment];
  }
  
  // Find the nearest space to split the text
  let splitIndex = midCharIndex;
  let leftSpace = segment.text.lastIndexOf(' ', midCharIndex);
  let rightSpace = segment.text.indexOf(' ', midCharIndex);

  if (leftSpace === -1) leftSpace = 0;
  if (rightSpace === -1) rightSpace = segment.text.length;

  // Choose the closest space to the middle
  if (midCharIndex - leftSpace <= rightSpace - midCharIndex) {
    splitIndex = leftSpace;
  } else {
    splitIndex = rightSpace;
  }


  // Create two new segments
  const segment1: TranscriptionSegment = {
    id: nextId,
    start: segment.start,
    end: midTime,
    text: segment.text.slice(0, splitIndex).trim()
  };

  const segment2: TranscriptionSegment = {
    id: nextId + 1,
    start: midTime,
    end: segment.end,
    text: segment.text.slice(splitIndex).trim()
  };

  let firstSegments = splitSegmentRecursively(segment1, nextId);
  let secondSegments = splitSegmentRecursively(segment2, nextId + firstSegments.length);
  // Recursively split each new segment if needed
  return [
    ...firstSegments,
    ...secondSegments
  ];
}

export type SubtitleStyle = {
  font: string;
  position: { y: number };
  colors: {
    line1: { text: string; background: string };
  };
  fontSize: number;
};

/**
 * Generates an ASS subtitle file content based on segments and styling
 */
export async function generateAssContent(
  segments: TranscriptionSegment[],
  style: SubtitleStyle,
  videoWidth: number,
  videoHeight: number
): Promise<string> {
  const startTime = performance.now();
  
  // Convert colors from hex to ASS format
  const primaryColor = hexToAssColor(style.colors.line1.text);
  const backgroundColor = hexToAssColor(style.colors.line1.background);
  
  // Fix vertical positioning - invert the calculation if needed
  // If position.y = 0 should be bottom and 100 should be top
  const yPositionInPixels = Math.round(((100 - style.position.y) / 100) * videoHeight);

  let assContent = `[Script Info]
Title: Auto-generated subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.font},${style.fontSize},&H${primaryColor},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Add each segment as a dialogue line with custom drawn rounded box
  let currLayer = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const startTime = formatAssTime(segment.start);
    const endTime = formatAssTime(segment.end);
    
    // Get text and estimate its width to set appropriate box dimensions
    const cleanText = segment.text.replace(/\n/g, ' ');
    const lines = splitIntoLines(cleanText, style.font, style.fontSize, videoWidth);

    const boxHeight = Math.round(style.fontSize * 1.2); // Height based on font size
    const cornerRadius = Math.min(20, boxHeight / 4);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bgLayer = currLayer;
      currLayer++;
      const textLayer = currLayer;
      currLayer++;

      // Apply darkening to the original hex color, then convert to ASS format
      const darkPercentage = i * 30; // 5% darker for each line
      const darkenedHex = i === 0 ? style.colors.line1.background : darkenHexColor(style.colors.line1.background, darkPercentage);
      const bgColor = hexToAssColor(darkenedHex);
      
      const txtWidth = typeof window === 'undefined' 
        ? await measureText(line, style.fontSize, style.font)
        : await measureText(line, style.fontSize, style.font);
      const boxWidth = Math.round(txtWidth);
      const bgPosX = Math.round(videoWidth/2 + boxWidth/2);
      const bgPosY = Math.round(yPositionInPixels + (( i + 0.5) * boxHeight) - (boxHeight * (lines.length - 0.5)));
      
      const textPosX = Math.round(videoWidth/2);
      const textPosY = Math.round(yPositionInPixels + (i * style.fontSize * 1.2) - (boxHeight * (lines.length - 0.5)));

      assContent += `Dialogue: ${bgLayer},${startTime},${endTime},Default,,0,0,0,,{\\an5\\pos(${bgPosX},${bgPosY})\\p1\\bord0\\shad0\\c&H${bgColor}&\\3c&H${bgColor}&}m ${-boxWidth/2} ${-boxHeight/2 + cornerRadius} b ${-boxWidth/2} ${-boxHeight/2} ${-boxWidth/2 + cornerRadius} ${-boxHeight/2} ${-boxWidth/2 + cornerRadius} ${-boxHeight/2} l ${boxWidth/2 - cornerRadius} ${-boxHeight/2} b ${boxWidth/2} ${-boxHeight/2} ${boxWidth/2} ${-boxHeight/2 + cornerRadius} ${boxWidth/2} ${-boxHeight/2 + cornerRadius} l ${boxWidth/2} ${boxHeight/2 - cornerRadius} b ${boxWidth/2} ${boxHeight/2} ${boxWidth/2 - cornerRadius} ${boxHeight/2} ${boxWidth/2 - cornerRadius} ${boxHeight/2} l ${-boxWidth/2 + cornerRadius} ${boxHeight/2} b ${-boxWidth/2} ${boxHeight/2} ${-boxWidth/2} ${boxHeight/2 - cornerRadius} ${-boxWidth/2} ${boxHeight/2 - cornerRadius} l ${-boxWidth/2} ${-boxHeight/2 + cornerRadius}{\\p0}\n`;
      assContent += `Dialogue: ${textLayer},${startTime},${endTime},Default,,0,0,0,,{\\an5\\pos(${textPosX},${textPosY})}${lines[i]}\n`;
      
    }

    // Box dimensions and roundness
    const boxWidth = Math.round(Math.min(cleanText.length * style.fontSize * 0.8)/ 2);  // Half width since position is center
    const boxPosX = videoWidth/2 + boxWidth/2;
    const boxPosY = yPositionInPixels + boxHeight/2;
    
  };
  
  const endTime = performance.now();
  const elapsedTime = endTime - startTime;
  
  return assContent;
}

function splitIntoLines(text: string, font: string, fontSize: number, videoWidth: number): string[] {
  const maxLines = 4;
  const maxLineWidth = videoWidth * 0.8;
  
  // Check if the entire text fits on one line
  if (measureText(text, fontSize, font) <= maxLineWidth) {
    return [text];
  }
  
  // Try splitting into increasing number of lines, until each line fits
  for (let numSplits = 2; numSplits <= maxLines; numSplits++) {
    const candidateLines = trySplitIntoNLines(text, numSplits, font, fontSize, maxLineWidth);
    
    // Check if all lines fit within the width constraint
    const allLinesFit = candidateLines.every(line => 
      measureText(line, fontSize, font) <= maxLineWidth
    );
    
    if (allLinesFit) {
      return candidateLines;
    }
  }
  
  // If we couldn't find a perfect split with all lines fitting,
  // use the maximum number of lines and do the best we can
  return forceSplitIntoNLines(text, maxLines, font, fontSize, maxLineWidth);
}

/**
 * Try to split text into N roughly equal parts at word boundaries
 */
function trySplitIntoNLines(
  text: string, 
  numLines: number, 
  font: string, 
  fontSize: number, 
  maxLineWidth: number
): string[] {
  const lines: string[] = [];
  const textLength = text.length;
  
  // Calculate the ideal character count per line for even distribution
  const idealCharsPerLine = Math.ceil(textLength / numLines);
  
  let currentPosition = 0;
  
  // Create n-1 lines, leaving the remainder for the last line
  for (let i = 0; i < numLines - 1; i++) {
    // Calculate the target position for this line end
    const targetPosition = Math.min(
      currentPosition + idealCharsPerLine,
      textLength
    );
    
    if (targetPosition >= textLength) {
      // We've reached the end of the text
      break;
    }
    
    // Find the nearest space before or after the target position
    let leftSpace = text.lastIndexOf(' ', targetPosition);
    let rightSpace = text.indexOf(' ', targetPosition);
    
    if (leftSpace === -1 || leftSpace < currentPosition) leftSpace = currentPosition;
    if (rightSpace === -1) rightSpace = textLength;
    
    // Choose the closest space to the target
    let splitPosition;
    if (targetPosition - leftSpace <= rightSpace - targetPosition && leftSpace > currentPosition) {
      splitPosition = leftSpace;
    } else if (rightSpace < textLength) {
      splitPosition = rightSpace;
    } else {
      // If no suitable space found, just split at the target position
      splitPosition = targetPosition;
    }
    
    // Extract the line and add to lines array
    const line = text.substring(currentPosition, splitPosition).trim();
    lines.push(line);
    
    // Update current position for next iteration
    currentPosition = splitPosition + (text[splitPosition] === ' ' ? 1 : 0);
  }
  
  // Add the last line with remaining text
  if (currentPosition < textLength) {
    lines.push(text.substring(currentPosition).trim());
  }
  
  return lines;
}

/**
 * Force split text into N lines, ensuring each line fits the width constraint
 * Used as a fallback when even distribution doesn't work
 */
function forceSplitIntoNLines(
  text: string, 
  numLines: number, 
  font: string, 
  fontSize: number, 
  maxLineWidth: number
): string[] {
  const lines: string[] = [];
  let remainingText = text;
  
  // For each line except the last
  for (let i = 0; i < numLines - 1 && remainingText.length > 0; i++) {
    // Find the maximum characters that can fit in one line
    let charsFit = remainingText.length;
    while (charsFit > 0 && measureText(remainingText.substring(0, charsFit), fontSize, font) > maxLineWidth) {
      charsFit--;
    }
    
    // If we found a good fit, find the nearest word boundary
    if (charsFit > 0 && charsFit < remainingText.length) {
      const lastSpace = remainingText.lastIndexOf(' ', charsFit);
      if (lastSpace > 0) {
        charsFit = lastSpace;
      }
    }
    
    // Add the line and update remaining text
    lines.push(remainingText.substring(0, charsFit).trim());
    remainingText = remainingText.substring(charsFit).trim();
  }
  
  // Add the remaining text as the last line, even if it's too long
  if (remainingText.length > 0) {
    lines.push(remainingText);
  }
  
  return lines;
}

/**
 * Helper function to convert hex color to ASS format (AABBGGRR)
 */
export function hexToAssColor(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse the hex color
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Convert to ASS format: AABBGGRR (alpha, blue, green, red)
  return `00${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`;
}

/**
 * Helper function to format time into ASS format (h:mm:ss.cc)
 */
export function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Darkens a hex color by a specified percentage
 * @param hexColor The hex color to darken (with or without #)
 * @param percentage The percentage to darken by (0-100)
 * @returns A darker hex color
 */
function darkenHexColor(hexColor: string, percentage: number): string {
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Parse the RGB components
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  
  // Calculate darkened values
  const darkenFactor = 1 - (percentage / 100);
  const newR = Math.max(0, Math.floor(r * darkenFactor));
  const newG = Math.max(0, Math.floor(g * darkenFactor));
  const newB = Math.max(0, Math.floor(b * darkenFactor));
  
  // Convert back to hex
  return `${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
} 