// Schema validation for YAML fixtures

import { IncidentScenarioFixture } from '../types';
// Use require for ajv to avoid ESM/CommonJS issues in Cypress
const Ajv = require('ajv');

// Import the JSON schema
const schema = require('./fixture-schema.json');

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

/**
 * Validates a fixture object against the JSON schema
 */
export function validateFixture(fixture: any): { valid: boolean; errors?: string[] } {
  const valid = validate(fixture);
  
  if (valid) {
    return { valid: true };
  }
  
  const errors = validate.errors?.map(error => {
    const path = error.instancePath ? error.instancePath : 'root';
    return `${path}: ${error.message}`;
  }) || [];
  
  return { valid: false, errors };
}

/**
 * Validates and parses YAML content with schema validation
 */
export function validateAndParseYamlFixture(yamlContent: string): { 
  fixture?: IncidentScenarioFixture; 
  valid: boolean; 
  errors?: string[] 
} {
  try {
    const yaml = require('js-yaml');
    const parsed = yaml.load(yamlContent);
    
    const validation = validateFixture(parsed);
    
    if (validation.valid) {
      return { fixture: parsed as IncidentScenarioFixture, valid: true };
    } else {
      return { valid: false, errors: validation.errors };
    }
  } catch (error) {
    return { 
      valid: false, 
      errors: [`YAML parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
    };
  }
}
