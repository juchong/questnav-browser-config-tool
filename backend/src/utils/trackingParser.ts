/**
 * Parser for `dumpsys tracking` output from Meta Quest devices
 * Splits the massive output into logical sections for easier analysis
 */

export interface TrackingSection {
  name: string;
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface ParsedTrackingData {
  rawOutput: string;
  sections: TrackingSection[];
  metadata: {
    uptime?: string;
    capturedAt?: string;
    deviceSerial?: string;
    totalLines: number;
    totalSections: number;
  };
}

/**
 * Parse dumpsys tracking output into structured sections
 */
export function parseTrackingOutput(output: string): ParsedTrackingData {
  const lines = output.split('\n');
  const sections: TrackingSection[] = [];
  
  // Extract metadata from the beginning
  const metadata: ParsedTrackingData['metadata'] = {
    totalLines: lines.length,
    totalSections: 0
  };

  // Try to extract captured timestamp (first line)
  const capturedAtMatch = lines[0]?.match(/Captured at: (.+)/);
  if (capturedAtMatch) {
    metadata.capturedAt = capturedAtMatch[1];
  }

  // Try to extract uptime
  const uptimeMatch = output.match(/Uptime:\s+([\d.]+)s/);
  if (uptimeMatch) {
    metadata.uptime = uptimeMatch[1] + 's';
  }

  // Try to extract device serial from calibration data
  const serialMatch = output.match(/SerialNumber[\"']?:\s*[\"']?([A-Z0-9]+)[\"']?/);
  if (serialMatch) {
    metadata.deviceSerial = serialMatch[1];
  }

  // Define section markers (ordered by appearance in output)
  const sectionMarkers = [
    { name: 'Sensor Device', start: /^Sensor Device:/, end: /^Fusion States:/ },
    { name: 'Fusion States', start: /^Fusion States:/, end: /^Recent Sensor events:/ },
    { name: 'Recent Sensor Events', start: /^Recent Sensor events:/, end: /^Active sensors:/ },
    { name: 'Active Sensors', start: /^Active sensors:/, end: /^Socket Buffer size/ },
    { name: 'Socket & Connection Info', start: /^Socket Buffer size/, end: /^Previous Registrations:/ },
    { name: 'Previous Registrations', start: /^Previous Registrations:/, end: /^eureka:\/\$|^dumpsys tracking/ },
    { name: 'Combined Controller Host Status', start: /^Combined Controller Host Status/, end: /^State Manager:/ },
    { name: 'State Manager', start: /^State Manager:/, end: /^Tracking capability glue/ },
    { name: 'Self-Tracked Headset Side', start: /^=========Begin SelftrackedHeadsetSide Dump State=========/, end: /^Tracking capability glue for iobt/ },
    { name: 'Inside Out Body Tracking (IOBT)', start: /^Tracking capability glue for iobt/, end: /^IOBT Glue Info/ },
    { name: 'IOBT Glue Info', start: /^IOBT Glue Info/, end: /^Head Tracker Host Status/ },
    { name: 'Head Tracker Host Status', start: /^Head Tracker Host Status/, end: /^Tracking capability glue for object/ },
    { name: 'Object Tracking', start: /^Tracking capability glue for object/, end: /^ExposureControlCmmv2 Glue Status/ },
    { name: 'Exposure Control & Metrics', start: /^ExposureControlCmmv2 Glue Status/, end: /^Tracking capability glue for face/ },
    { name: 'Face & Eye Tracking', start: /^Tracking capability glue for face/, end: /^<Begin_FaceEyeTracking>/ },
    { name: 'Face & Eye Tracking Details', start: /^<Begin_FaceEyeTracking>/, end: /^<End_FaceEyeTracking>/ },
    { name: 'Face Tracking Glue Status', start: /^face Glue Status/, end: /^Historical events:/ },
    { name: 'Historical Events', start: /^Historical events:/, end: null } // Last section
  ];

  // Parse sections
  let currentIndex = 0;
  
  for (let i = 0; i < sectionMarkers.length; i++) {
    const marker = sectionMarkers[i];
    const nextMarker = i < sectionMarkers.length - 1 ? sectionMarkers[i + 1] : null;
    
    // Find start of this section
    let startLine = -1;
    for (let j = currentIndex; j < lines.length; j++) {
      if (marker.start.test(lines[j])) {
        startLine = j;
        break;
      }
    }
    
    if (startLine === -1) {
      // Section not found, skip
      continue;
    }
    
    // Find end of this section
    let endLine = lines.length - 1;
    if (marker.end) {
      for (let j = startLine + 1; j < lines.length; j++) {
        if (marker.end.test(lines[j])) {
          endLine = j - 1;
          break;
        }
      }
    } else if (nextMarker) {
      // Use next marker as end
      for (let j = startLine + 1; j < lines.length; j++) {
        if (nextMarker.start.test(lines[j])) {
          endLine = j - 1;
          break;
        }
      }
    }
    
    // Extract section content
    const sectionLines = lines.slice(startLine, endLine + 1);
    const content = sectionLines.join('\n');
    
    sections.push({
      name: marker.name,
      content: content,
      lineStart: startLine + 1, // 1-indexed for readability
      lineEnd: endLine + 1
    });
    
    currentIndex = endLine + 1;
  }
  
  // If no sections were parsed, create a single "Full Output" section
  if (sections.length === 0) {
    sections.push({
      name: 'Full Output',
      content: output,
      lineStart: 1,
      lineEnd: lines.length
    });
  }

  metadata.totalSections = sections.length;

  return {
    rawOutput: output,
    sections,
    metadata
  };
}

/**
 * Extract key statistics from tracking data for quick reference
 */
export function extractKeyStats(parsedData: ParsedTrackingData): Record<string, any> {
  const stats: Record<string, any> = {};
  
  // Add metadata
  if (parsedData.metadata.uptime) {
    stats.uptime = parsedData.metadata.uptime;
  }
  if (parsedData.metadata.deviceSerial) {
    stats.deviceSerial = parsedData.metadata.deviceSerial;
  }
  if (parsedData.metadata.capturedAt) {
    stats.capturedAt = parsedData.metadata.capturedAt;
  }
  
  // Extract sensor count
  const sensorMatch = parsedData.rawOutput.match(/Total (\d+) h\/w sensors/);
  if (sensorMatch) {
    stats.totalSensors = parseInt(sensorMatch[1]);
  }
  
  // Extract tracking level
  const trackingLevelMatch = parsedData.rawOutput.match(/Tracking Level: (\w+)/);
  if (trackingLevelMatch) {
    stats.trackingLevel = trackingLevelMatch[1];
  }
  
  // Extract power state
  const powerStateMatch = parsedData.rawOutput.match(/Power state: (\w+)/);
  if (powerStateMatch) {
    stats.powerState = powerStateMatch[1];
  }
  
  // Extract IOBT fidelity
  const iobtFidelityMatch = parsedData.rawOutput.match(/current IOBT fidelity is (\w+)/);
  if (iobtFidelityMatch) {
    stats.iobtFidelity = iobtFidelityMatch[1];
  }
  
  return stats;
}
