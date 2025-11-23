/**
 * Service for processing command execution results
 * Handles special cases like diagnostic commands that need parsing
 */

import { CommandExecutionResult } from '../models/types';
import { parseTrackingOutput, extractKeyStats } from '../utils/trackingParser';

/**
 * Process command results, applying special handling for diagnostic commands
 */
export function processCommandResults(results: CommandExecutionResult[]): CommandExecutionResult[] {
  return results.map(result => {
    // Check if this is a diagnostic command that needs parsing
    if (result.category === 'diagnostic' && result.success && result.output) {
      return processDiagnosticCommand(result);
    }
    
    // Return as-is for non-diagnostic commands
    return result;
  });
}

/**
 * Process diagnostic commands - parse output into structured data
 */
function processDiagnosticCommand(result: CommandExecutionResult): CommandExecutionResult {
  const command = result.command.toLowerCase();
  
  // Handle dumpsys tracking
  if (command.includes('dumpsys') && command.includes('tracking')) {
    return parseTrackingCommand(result);
  }
  
  // Add more diagnostic command parsers here as needed
  // e.g., dumpsys battery, dumpsys meminfo, etc.
  
  // If no specific parser, return as-is
  return result;
}

/**
 * Parse dumpsys tracking output
 */
function parseTrackingCommand(result: CommandExecutionResult): CommandExecutionResult {
  if (!result.output) {
    return result;
  }
  
  try {
    const parsedData = parseTrackingOutput(result.output);
    const keyStats = extractKeyStats(parsedData);
    
    return {
      ...result,
      parsed_data: {
        sections: parsedData.sections,
        metadata: parsedData.metadata,
        key_stats: keyStats
      }
    };
  } catch (error) {
    console.error('Failed to parse tracking output:', error);
    // Return original result if parsing fails
    return result;
  }
}
